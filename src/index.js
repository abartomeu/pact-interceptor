'use strict'

const URL = require('url')
const Mitm = require('mitm')
const http = require('http')
const find = require('lodash.find')
const isNil = require('lodash.isnil')

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
    const blacklist = []

    if (isNil(url)) {
      console.log('!!!! INTERCEPTING ALL REQUESTS !!!!')
    } else {
      // logger.info(`Intercepting URL "${url}"`)
      const parsedUrl = URL.parse(url)
      if (parsedUrl.port === null) {
        parsedUrl.port = parsedUrl.protocol === 'http:' ? 80 : 443
      }
      blacklist.push(parsedUrl)
    }

    // logger.info('Enabling interceptor.')
    this.mitm.enable()
    this.disabled = false

    const whitelist = this.whitelist
    this.mitm.on('connect', function (socket, opts) {
      const port = opts.port || null

      // logger.info(`Intercepting connection with hostname "${opts.host}", port "${port}"`)

      const foundBypass = !!find(whitelist, { hostname: opts.host, port })
      const shouldIntercept = !!find(blacklist, { hostname: opts.host, port })
      if (foundBypass || !shouldIntercept) {
        // logger.info(`Bypassing request to "${opts.host}"`)
        socket.bypass()
      }
    })

    const proxyHost = this.proxyHost
    this.mitm.on('request', (interceptedRequest, res) => {
      // logger.info(`Request intercepted. Triggering call to Mock Server on "${proxyHost}${interceptedRequest.url}"`)

      const opts = URL.parse(`${proxyHost}${interceptedRequest.url}`)
      opts.method = interceptedRequest.method.toLowerCase()
      opts.headers = interceptedRequest.headers || {}

      const proxyRequest = http.request(opts, (interceptedResponse) => {
        let interceptedResponseBody = ''
        interceptedResponse.setEncoding('utf8')
        interceptedResponse.on('data', (data) => { interceptedResponseBody += data })
        interceptedResponse.on('end', () => {
          // logger.info(`HTTP ${interceptedResponse.statusCode} on ${interceptedRequest.url}`)

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
