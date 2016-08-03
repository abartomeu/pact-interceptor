var sinon = require('sinon')
var expect = require('chai').expect
var request = require('superagent')

var Interceptor = require('../src')

describe('Interceptor', () => {

  describe('#constructor', () => {
    it('creates Interceptor for targetHost', () => {
      const interceptor = new Interceptor('http://proxy:1234')
      expect(interceptor).to.not.be.undefined
      expect(interceptor.disabled).to.eql(true)
    })

    it('does not create Interceptor when proxy is missing', () => {
      expect(() => new Interceptor()).to.throw(Error, 'Please provide a proxy to route the request to.')
    })

    describe('mitm interceptor', () => {
      const interceptor = new Interceptor('http://proxy:1234')

      before(() => {
        sinon.spy(interceptor.mitm, 'on')
        interceptor.interceptRequestsOn('www.google.com.au')
      })

      after(() => {
        interceptor.mitm.on.restore()
        interceptor.stopIntercepting()
      })

      it('is listening on "connect"', () => {
        expect(interceptor.mitm.on).to.have.been.calledWith('connect')
      })

      it('is listening on "request"', () => {
        expect(interceptor.mitm.on).to.have.been.calledWith('request')
      })
    })
  })

  describe('when host is supposed to be intercepted', () => {
    var nock
    const interceptor = new Interceptor('http://localhost:1234')

    beforeEach(() => {
      interceptor.interceptRequestsOn('http://docs.pact.io')
      nock = require('nock')
    });

    afterEach(() => {
      nock.restore()
      interceptor.stopIntercepting()
    })

    it('intercepts the request going to "docs.pact.io"', (done) => {
      nock('http://localhost:1234')
        .get('/documentation/javascript.html')
        .reply(200, { data: 'successfully intercepted' })

      request.get('http://docs.pact.io/documentation/javascript.html')
        .then((response) => {
          expect(JSON.parse(response.text)).to.eql({ data: 'successfully intercepted' })
          done()
        })
    })
  })

  describe('when an error happens upon interception', () => {
    const interceptor = new Interceptor('http://localhost:1234')

    beforeEach(() => {
      interceptor.interceptRequestsOn('http://docs.pact.io')
    });

    afterEach(() => {
      interceptor.stopIntercepting()
    })

    it('ends the request with an error as localhost:1234 does not exist', (done) => {
      request.get('http://docs.pact.io/documentation/javascript.html')
        .then(
          () => { done(new Error('promise should have failed'))},
          (err) => {
            expect(err.response.text).to.eql('connect ECONNREFUSED 127.0.0.1:1234')
            done()
          }
        )
    })
  })
})
