'use strict'

var URL = require('url')
var Mitm = require('mitm')
var http = require('http')
var find = require('lodash.find')
var isNil = require('lodash.isnil')

module.exports = class Interceptor {

  constructor (proxyHost) {
    if (isNil(proxyHost)) {
      throw new Error('Please provide a proxy to route the request to.')
    }

    this.whitelist = [ URL.parse(proxyHost) ]
    this.mitm = Mitm()
    this.mitm.disable()
    this.disabled = true
    this.proxyHost = proxyHost
  }

  interceptRequestsOn (url) {
    var blacklist = []

    if (isNil(url)) {
      console.log('!!!! INTERCEPTING ALL REQUESTS !!!!')
    } else {
      // logger.info(`Intercepting URL "${url}"`)
      var parsedUrl = URL.parse(url)
      if (parsedUrl.port === null) {
        parsedUrl.port = parsedUrl.protocol === 'http:' ? 80 : 443
      }
      blacklist.push(parsedUrl)
    }

    // logger.info('Enabling interceptor.')
    this.mitm.enable()
    this.disabled = false

    var whitelist = this.whitelist
    this.mitm.on('connect', function (socket, opts) {
      var port = opts.port || null

      // logger.info(`Intercepting connection with hostname "${opts.host}", port "${port}"`)

      var foundBypass = !!find(whitelist, { hostname: opts.host, port })
      var shouldIntercept = !!find(blacklist, { hostname: opts.host, port })
      if (foundBypass || !shouldIntercept) {
        // logger.info(`Bypassing request to "${opts.host}"`)
        socket.bypass()
      }
    })

    var proxyHost = this.proxyHost
    this.mitm.on('request', (interceptedRequest, res) => {
      // console.log(`Request intercepted. Triggering call to Mock Server on "${proxyHost}${interceptedRequest.url}"`)

      var opts = URL.parse(`${proxyHost}${interceptedRequest.url}`)
      opts.method = interceptedRequest.method.toLowerCase()
      opts.headers = interceptedRequest.headers || {}

      var proxyRequest = http.request(opts, (interceptedResponse) => {
        var interceptedResponseBody = ''
        interceptedResponse.setEncoding('utf8')
        interceptedResponse.on('data', (data) => { interceptedResponseBody += data })
        interceptedResponse.on('end', () => {
          // console.log(`HTTP ${interceptedResponse.statusCode} on ${interceptedRequest.url}`)
          // console.log(interceptedResponseBody)

          if (interceptedResponse.statusCode > 400) {
            res.statusCode = interceptedResponse.statusCode
          }

          res.end(interceptedResponseBody)
        })
      })

      proxyRequest.on('error', (err) => {
        // console.log(`Error on intercepting "${interceptedRequest.url}"`)
        res.statusCode = 500
        res.end(err.message)
      })

      proxyRequest.end()
    })
  }

  stopIntercepting () {
    this.mitm.disable()
    this.disabled = true
  }

}
