var path = require('path')
var Pact = require('pact')
var expect = require('chai').expect
var request = require('superagent')
var wrapper = require('@pact-foundation/pact-node')

var Interceptor = require('../src/index')

describe('Pact with Interceptor', () => {

  var MOCK_PORT = Math.floor(Math.random() * 999) + 9000
  var PROVIDER_URL = `http://localhost:${Math.floor(Math.random() * 999) + 9000}`
  var mockServer = wrapper.createServer({
    port: MOCK_PORT,
    log: path.resolve(process.cwd(), 'logs', 'mockserver-integration.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    spec: 2
  })

  var interceptor = new Interceptor(`http://localhost:${MOCK_PORT}`)

  var EXPECTED_BODY = [{
    id: 1,
    name: 'Project 1',
    due: '2016-02-11T09:46:56.023Z',
    tasks: [
      {id: 1, name: 'Do the laundry', 'done': true},
      {id: 2, name: 'Do the dishes', 'done': false},
      {id: 3, name: 'Do the backyard', 'done': false},
      {id: 4, name: 'Do nothing', 'done': false}
    ]
  }]

  var provider

  before((done) => {
    mockServer.start().then(() => {
      provider = Pact({
        consumer: 'Consumer Interceptor',
        provider: 'Provider Interceptor',
        port: MOCK_PORT
      })
      interceptor.interceptRequestsOn(PROVIDER_URL)
      done()
    })
  })

  after((done) => {
    provider.finalize()
      .then(() => {
        wrapper.removeAllServers()
      })
      .then(() => {
        interceptor.stopIntercepting()
        done()
      })
  })

  context('with a single request', () => {

    // add interactions, as many as needed
    beforeEach((done) => {
      provider.addInteraction({
        state: 'i have a list of projects',
        uponReceiving: 'a request for projects',
        withRequest: {
          method: 'get',
          path: '/projects',
          headers: { 'Accept': 'application/json' }
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: EXPECTED_BODY
        }
      }).then(() => done())
    })

    // execute your assertions
    it('successfully verifies', (done) => {
      var verificationPromise = request
        .get(`${PROVIDER_URL}/projects`)
        .set({ 'Accept': 'application/json' })
        .then(provider.verify)

      verificationPromise.then(function (body) {
        expect(body).to.eql(JSON.stringify(EXPECTED_BODY))
        done()
      })
    })
  })

  context('with two requests', () => {

    beforeEach((done) => {
      var interaction2 = provider.addInteraction({
        state: 'i have a list of projects',
        uponReceiving: 'a request for a project that does not exist',
        withRequest: {
          method: 'get',
          path: '/projects/2',
          headers: { 'Accept': 'application/json' }
        },
        willRespondWith: {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      }).then(() => done())
    })

    it('successfully verifies', (done) => {
      var promiseResults = []

      var verificationPromise =
          request.get(`${PROVIDER_URL}/projects`)
            .set({ 'Accept': 'application/json' })
            .then((response) => {
              promiseResults.push(response)
              return request.get(`${PROVIDER_URL}/projects/2`).set({ 'Accept': 'application/json' })
            })
            .then(() => {}, (err) => { promiseResults.push(err.response) })
            .then(() => provider.verify(promiseResults))

      verificationPromise.then(function (body) {
        expect(body).to.eql([JSON.stringify(EXPECTED_BODY), ''])
        done()
      })
    })
  })

  context('with an unexpected interaction', () => {
    it('fails verification', (done) => {
      var promiseResults = []

      var verificationPromise =
        request.get(`${PROVIDER_URL}/projects`)
          .set({ 'Accept': 'application/json' })
          .then((response) => {
            promiseResults.push(response)
            return request.delete(`${PROVIDER_URL}/projects/2`)
          })
          .then(() => {}, (err) => { promiseResults.push(err.response) })
          .then(() => provider.verify(promiseResults))

      verificationPromise.then(undefined, function (err) {
        expect(err[0]).to.contain('No interaction found for DELETE /projects/2')
        done()
      })
    })
  })

})
