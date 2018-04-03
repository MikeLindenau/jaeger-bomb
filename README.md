# Jaeger Plugin for Seneca

This is a [Seneca](https://github.com/senecajs/seneca) plugin to allow you to use [Jaeger](http://jaegertracing.io/) for tracing.

## Installation

`npm install --save jaeger-bomb`

## Initialization

```javascript
var Seneca = require('seneca')

// See schema https://github.com/jaegertracing/jaeger-client-node/blob/master/src/configuration.js#L37
var config = {
  reporter: {
      logSpans: true,
      flushIntervalMs: 10
  },
};
var options = {
  tags: {
    'my-awesome-service.version': '1.1.2',
  },
  metrics: metrics,
  logger: logger,
};

var options = {
    serviceName: 'my-awesome-service',
    serviceVersion: '1.1.2',
    jaeger: {
        config: congig,
        options: options
    }
}
```