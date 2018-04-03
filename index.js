const assert = require('assert')
const Tracer = require('jaeger-client').initTracer
const opentracing = require('opentracing')
const pkg = require('./package.json')
const { internalAction, getPattern, getPlugin, applyTags } = require('./utils')
const { defaultsDeep } = require('lodash')

const VERSION = pkg.version
const SERVICE_NAME = pkg.name

const tags = {
  KIND: 'kind',
  SENECA_PATTERN: 'seneca.pattern',
  SENECA_TX: 'seneca.tx',
  SENECA_ACTION: 'seneca.action'
}

module.exports = function JaegerBomb(options) {
  options = options || {}
  const seneca = this
  const conf = (options.jaeger && options.jaeger.config) || {}
  const opts = (options.jaeger && options.jaeger.options) || {}
  const serviceName = options.serviceName
  const serviceVersion = options.serviceVersion || VERSION

  assert(serviceName, 'JaegerBomb/service name is required.')

  const jaegerDefaultConfig = {
    serviceName,
    reporter: {
      flushIntervalMs: 10,
      logSpans: false
    }
  }

  const jaegerDefaultOptions = {
    tags: {
      [`${SERVICE_NAME}.version`]: VERSION,
      [`${serviceName}.version`]: serviceVersion
    }
  }

  const jaegerConfig = defaultsDeep({}, jaegerDefaultConfig, conf)
  const jaegerOptions = defaultsDeep({}, jaegerDefaultOptions, opts)
  const tracer = Tracer(jaegerConfig, jaegerOptions)

  seneca.inward(jaegerInward)
  seneca.outward(jaegerOutward)

  function jaegerInward(ctx, data) {
    if (internalAction(data.msg)) {
      return
    }

    const msg = data.msg
    const meta = data.meta
    const textCarrier = {}

    ctx.seneca.fixedargs.trace$ = ctx.seneca.fixedargs.trace$ || {}
    ctx.seneca.fixedargs = ctx.seneca.fixedargs || {}
    msg.trace$ = msg.trace$ || {}

    let trace = ctx.seneca.fixedargs.opentracing || null
    let traceCarrier = ctx.seneca.fixedargs.trace$.opentracing || null
    let parentSpan = trace

    // For corss process tracing
    if (msg.__server__) {
      msg.__server__ = false
      parentSpan = tracer.extract(
        opentracing.FORMAT_TEXT_MAP,

        // When going over the network we lose the fixedargs context
        // but the context gets added to msg by seneca so we can use it.
        msg.trace$.opentracing
      )
    }

    // Network requests need to be serialized using
    // extract and inject functionality for cross systems
    if (msg.plugin$ && msg.plugin$.name === 'client$') {
      msg.__server__ = true
    }

    const span = parentSpan
      ? tracer.startSpan(meta.action, { childOf: parentSpan })
      : tracer.startSpan(meta.action)

    applyTags(span, {
      [opentracing.Tags.SAMPLING_PRIORITY]: 1,
      [tags.KIND]: 'command',
      [tags.SENECA_PATTERN]: meta.pattern,
      [tags.SENECA_ACTION]: meta.action
    })

    tracer.inject(span, opentracing.FORMAT_TEXT_MAP, textCarrier)

    ctx.seneca.fixedargs.trace$.opentracing = textCarrier
    ctx.seneca.fixedargs.opentracing = span
  }

  function jaegerOutward(ctx, data) {
    const msg = data.msg
    const meta = data.meta
    const trace = ctx.seneca.fixedargs.opentracing || null

    // If there are no tracers we dont need to do anything
    if (!trace) return

    // Ignore internal actions
    if (internalAction(msg)) return

    trace.finish()
  }
}
