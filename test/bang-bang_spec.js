const helper = require('node-red-node-test-helper')
helper.init(require.resolve('node-red'))
const bangbangNode = require('../bang-bang/bang-bang.js')

const msgTimeout = 6

function loadFlow (node, flow) {
  return new Promise(resolve => helper.load(node, flow, resolve))
}

function promiseNodeCallback (node, callbackName) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      node.on(callbackName, _ => { throw new Error('callback after timeout') })
      reject(new Error('timeout'))
    }, msgTimeout)

    node.on(callbackName, message => {
      clearTimeout(t)
      resolve(message)
    })
  })
}

async function promiseNodeResponse (testNode, helperNode, payload) {
  testNode.receive(payload)
  return await promiseNodeCallback(helperNode, 'input')
}

async function testHysteresisAsync (testNode, helperNode) {
  // default to low
  const msg1 = await promiseNodeResponse(testNode, helperNode, { payload: 7 }).should.be.resolved()
  msg1.should.have.property('payload', false)

  // into deadband
  await promiseNodeResponse(testNode, helperNode, { payload: 9 }).should.be.rejectedWith('timeout')

  // low to high
  const msg2 = await promiseNodeResponse(testNode, helperNode, { payload: 11 }).should.be.resolved()
  msg2.should.have.property('payload', true)

  // into deadband
  await promiseNodeResponse(testNode, helperNode, { payload: 9 }).should.be.rejectedWith('timeout')

  // high to low
  const msg3 = await promiseNodeResponse(testNode, helperNode, { payload: 7 }).should.be.resolved()
  msg3.should.have.property('payload', false)
}

describe('bang-bang node', function () {
  let n1
  let n2

  async function prepareFlow (config) {
    const flow = [
      {
        id: 'n1',
        type: 'bang-bang',
        name: 'bangbangNode',
        propertyType: config.propertyType || 'msg',
        property: config.property || 'payload',
        thresholdUpperType: config.thresholdUpperType || 'num',
        thresholdUpper: config.thresholdUpper || 10,
        thresholdLowerType: config.thresholdLowerType || 'num',
        thresholdLower: config.thresholdLower || 8,
        outputHighType: config.outputHighType || 'bool',
        outputHigh: config.outputHigh || true,
        outputLowType: config.outputLowType || 'bool',
        outputLow: config.outputLow || false,
        initialState: config.initialState,
        wires: [['n2']],
        z: {}
      },
      { id: 'n2', type: 'helper' }
    ]
    await loadFlow(bangbangNode, flow)

    n1 = helper.getNode('n1')
    n2 = helper.getNode('n2')
  }

  before(function (done) {
    helper.startServer(done)
  })

  after(function (done) {
    helper.stopServer(done)
  })

  afterEach(function (done) {
    helper.unload().then(done)
  })

  it('should be loaded with correct defaults', async function () {
    const flow = [{ id: 'n1', type: 'bang-bang', name: 'bangbangNode' }]
    await loadFlow(bangbangNode, flow)
    const n1 = helper.getNode('n1')
    n1.should.have.property('name', 'bangbangNode')
    n1.should.have.property('propertyType', 'msg')
    n1.should.have.property('property', 'payload')
    n1.should.have.property('thresholdUpper', undefined)
    n1.should.have.property('thresholdUpperType', 'num')
    n1.should.have.property('thresholdLower', undefined)
    n1.should.have.property('thresholdLowerType', 'num')
    n1.should.have.property('outputHigh', true)
    n1.should.have.property('outputHighType', 'bool')
    n1.should.have.property('outputLow', false)
    n1.should.have.property('outputLowType', 'bool')
    n1.should.have.property('state', 'undefined')
    n1.should.have.property('valid', true)
  })

  it('should not send output if in invalid state', async function () {
    await prepareFlow({})
    n1.valid = false
    await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
  })

  it('should be able to set initial state', async function () {
    await prepareFlow({ initialState: 'low' })
    n1.should.have.property('state', 'low')
  })

  describe('process input', function () {
    it('should understand string input', async function () {
      await prepareFlow({})
      const msg = await promiseNodeResponse(n1, n2, { payload: '11' }).should.be.resolved()
      msg.should.have.property('payload', true)
    })

    it('should read value from custom property', async function () {
      await prepareFlow({ property: 'prop1' })
      const msg = await promiseNodeResponse(n1, n2, { prop1: 11 }).should.be.resolved()
      msg.should.have.property('payload', true)
    })

    it('should report unparseable input', async function () {
      await prepareFlow({})
      await promiseNodeResponse(n1, n2, { payload: 'foo' }).should.be.rejectedWith('timeout')
      n1.error.should.be.calledWithExactly('Property is not a number')
    })

    it('should silently ignore messages without payload property', async function () {
      await prepareFlow({})
      await promiseNodeResponse(n1, n2, { someField: 42 }).should.be.rejectedWith('timeout')
      n1.error.should.not.be.called()
      n1.warn.should.not.be.called()
    })
  })

  describe('set thresholds', function () {
    it('should be able to set thresholds with numbers', async function () {
      await prepareFlow({
        thresholdUpperType: 'num',
        thresholdUpper: 10,
        thresholdLowerType: 'num',
        thresholdLower: 8
      })
      n1.should.have.property('thresholdUpper', 10)
      n1.should.have.property('thresholdUpperType', 'num')
      n1.should.have.property('thresholdLower', 8)
      n1.should.have.property('thresholdLowerType', 'num')
      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds from flow context', async function () {
      await prepareFlow({
        thresholdUpperType: 'flow',
        thresholdUpper: 'th_high',
        thresholdLowerType: 'flow',
        thresholdLower: 'th_low'
      })
      n1.context().flow.set('th_low', 8)
      n1.context().flow.set('th_high', 10)
      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds from global context', async function () {
      await prepareFlow({
        thresholdUpperType: 'global',
        thresholdUpper: 'th_high',
        thresholdLowerType: 'global',
        thresholdLower: 'th_low'
      })
      n1.context().global.set('th_low', 8)
      n1.context().global.set('th_high', 10)
      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds with JSONata', async function () {
      await prepareFlow({
        thresholdUpperType: 'jsonata',
        thresholdUpper: '$flowContext("th_low") + 2',
        thresholdLowerType: 'flow',
        thresholdLower: 'th_low'
      })
      n1.context().flow.set('th_low', 8)
      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds from env', async function () {
      process.env.TH_HIGH = '10'
      process.env.TH_LOW = '8'
      await prepareFlow({
        thresholdUpperType: 'env',
        thresholdUpper: 'TH_HIGH',
        thresholdLowerType: 'env',
        thresholdLower: 'TH_LOW'
      })
      await testHysteresisAsync(n1, n2)
      delete process.env.TH_HIGH
      delete process.env.TH_LOW
    })

    it('should report invalid JSONata in threshold', async function () {
      await prepareFlow({ thresholdUpperType: 'jsonata', thresholdUpper: '$.payload +' })
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
      n1.error.should.be.calledWithMatch(/Invalid expression used as threshold: .+/)
    })
  })

  describe('set outputs', function () {
    it('should be able to set output to msg property', async function () {
      await prepareFlow({ outputHighType: 'msg', outputHigh: 'prop1' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11, prop1: 'val1' }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to flow variable', async function () {
      await prepareFlow({ outputHighType: 'flow', outputHigh: 'var1' })
      n1.context().flow.set('var1', 'val1')
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to global variable', async function () {
      await prepareFlow({ outputHighType: 'global', outputHigh: 'var1' })
      n1.context().global.set('var1', 'val1')
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to string', async function () {
      await prepareFlow({ outputHighType: 'str', outputHigh: 'val1' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to number', async function () {
      await prepareFlow({ outputHighType: 'num', outputHigh: 42 })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 42)
    })

    it('should be able to set output to boolean', async function () {
      await prepareFlow({ outputHighType: 'bool', outputHigh: true })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', true)
    })

    it('should be able to set output to JSON', async function () {
      await prepareFlow({ outputHighType: 'json', outputHigh: '{"key": "value"}' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload')
      msg.payload.should.have.property('key', 'value')
    })

    it('should be able to set output to Buffer', async function () {
      await prepareFlow({ outputHighType: 'bin', outputHigh: '[104, 101, 108, 108, 111]' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', Buffer.from([104, 101, 108, 108, 111]))
    })

    it('should be able to set output to JSONata', async function () {
      await prepareFlow({ outputHighType: 'jsonata', outputHigh: '$.payload + 31' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 42)
    })

    it('should be able to set output to env vars', async function () {
      process.env.OUT_HIGH = 'val1'
      await prepareFlow({ outputHighType: 'env', outputHigh: 'OUT_HIGH' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
      delete process.env.OUT_HIGH
    })

    it('should be able to set output to original message', async function () {
      await prepareFlow({ outputHighType: 'pay' })
      const msg = await promiseNodeResponse(n1, n2, { payload: 11, prop1: 'val1' }).should.be.resolved()
      msg.should.have.property('payload', 11)
      msg.should.have.property('prop1', 'val1')
    })

    it('should be able to set output to nothing', async function () {
      await prepareFlow({ outputHighType: 'nul' })
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should disable output if numeric value is unparseable', async function () {
      await prepareFlow({ outputHighType: 'num', outputHigh: 'bug' })
      n1.error.should.be.calledWithMatch(/Invalid output expression for rising edge.+/)
      n1.should.have.property('valid', false)
    })

    it('should disable output if JSON expression is invalid', async function () {
      await prepareFlow({ outputLowType: 'json', outputLow: '{"key": "value"' })
      n1.error.should.be.calledWithMatch(/Invalid output expression for falling edge.+/)
      n1.should.have.property('valid', false)
    })

    it('should disable output if Buffer expression is invalid', async function () {
      await prepareFlow({ outputLowType: 'bin', outputLow: '[95, 96, 97, 98' })
      n1.error.should.be.calledWithMatch(/Invalid output expression for falling edge.+/)
      n1.should.have.property('valid', false)
    })

    it('should disable output if JSONata expression is invalid', async function () {
      await prepareFlow({ outputHighType: 'jsonata', outputHigh: '$.payload +' })
      n1.error.should.be.calledWithMatch(/Invalid output expression for rising edge.+/)
      n1.should.have.property('valid', false)
    })

    it('should warn if output could not be calculated', async function () {
      await prepareFlow({ outputHighType: 'jsonata', outputHigh: '$.payloat + 31' })
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
      n1.warn.should.be.calledWithExactly('Output could not be calculated')
    })
  })

  describe('set status', function () {
    it('should set proper status by default', async function () {
      const flow = [{ id: 'n1', type: 'bang-bang', name: 'bangbangNode' }]
      await loadFlow(bangbangNode, flow)
      const n1 = helper.getNode('n1')
      n1.status.should.be.calledWithExactly({ fill: 'grey', shape: 'dot', text: 'undefined' })
    })

    it('should set proper status on low output', async function () {
      await prepareFlow({ thresholdUpper: 10, thresholdLower: 8 })
      await promiseNodeResponse(n1, n2, { payload: 7 }).should.be.resolved()
      n1.status.should.be.calledWithExactly({ fill: 'blue', shape: 'dot', text: 'low' })
    })

    it('should set proper status on high output', async function () {
      await prepareFlow({ thresholdUpper: 10, thresholdLower: 8 })
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      n1.status.should.be.calledWithExactly({ fill: 'red', shape: 'dot', text: 'high' })
    })
  })
})
