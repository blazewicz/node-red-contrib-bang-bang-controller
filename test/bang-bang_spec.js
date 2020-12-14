const helper = require('node-red-node-test-helper')
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

helper.init(require.resolve('node-red'))

describe('bang-bang node', function () {
  before(function (done) {
    helper.startServer(done)
  })

  after(function (done) {
    helper.stopServer(done)
  })

  afterEach(function (done) {
    helper.unload()
      .then(() => done())
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

  it('should be able to set initial state', async function () {
    const flow = [{ id: 'n1', type: 'bang-bang', name: 'bangbangNode', initialState: 'low' }]
    await loadFlow(bangbangNode, flow)

    const n1 = helper.getNode('n1')

    n1.should.have.property('state', 'low')
  })

  it('should understand string input', async function () {
    const flow = [
      {
        id: 'n1',
        type: 'bang-bang',
        name: 'bangbangNode',
        thresholdUpper: 10,
        thresholdLower: 8,
        wires: [['n2']]
      },
      { id: 'n2', type: 'helper' }
    ]
    await loadFlow(bangbangNode, flow)

    const n1 = helper.getNode('n1')
    const n2 = helper.getNode('n2')

    const msg = await promiseNodeResponse(n1, n2, { payload: '11' }).should.be.resolved()
    msg.should.have.property('payload', true)
  })

  it('should report unparseable input', async function () {
    const flow = [{
      id: 'n1',
      type: 'bang-bang',
      name: 'bangbangNode',
      thresholdUpper: 10,
      thresholdLower: 8
    }]
    await loadFlow(bangbangNode, flow)

    const n1 = helper.getNode('n1')

    n1.receive({ payload: 'foo' })
    const call = await promiseNodeCallback(n1, 'call:error').should.be.resolved()
    call.should.be.calledWithExactly('Property is not a number')
  })

  it('should ignore messages without payload', async function () {
    const flow = [
      {
        id: 'n1',
        type: 'bang-bang',
        name: 'bangbangNode',
        thresholdUpper: 10,
        thresholdLower: 8,
        wires: [['n2']]
      },
      { id: 'n2', type: 'helper' }
    ]
    await loadFlow(bangbangNode, flow)

    const n1 = helper.getNode('n1')
    const n2 = helper.getNode('n2')

    await promiseNodeResponse(n1, n2, { someField: 42 }).should.be.rejectedWith('timeout')
  })

  describe('set thresholds', function () {
    it('should be able to set thresholds with numbers', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.should.have.property('thresholdUpper', 10)
      n1.should.have.property('thresholdUpperType', 'num')
      n1.should.have.property('thresholdLower', 8)
      n1.should.have.property('thresholdLowerType', 'num')

      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds from flow context', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpperType: 'flow',
          thresholdUpper: 'th_high',
          thresholdLowerType: 'flow',
          thresholdLower: 'th_low',
          wires: [['n2']],
          z: 'flow'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.context().flow.set('th_low', 8)
      n1.context().flow.set('th_high', 10)

      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds from global context', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpperType: 'global',
          thresholdUpper: 'th_high',
          thresholdLowerType: 'global',
          thresholdLower: 'th_low',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.context().global.set('th_low', 8)
      n1.context().global.set('th_high', 10)

      await testHysteresisAsync(n1, n2)
    })

    it('should be able to set thresholds with JSONata', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpperType: 'jsonata',
          thresholdUpper: '$flowContext("th_low") + 2',
          thresholdLowerType: 'flow',
          thresholdLower: 'th_low',
          wires: [['n2']],
          z: 'flow'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.context().flow.set('th_low', 8)

      await testHysteresisAsync(n1, n2)
    })

    describe('env var', function () {
      before(function () {
        process.env.TH_HIGH = '10'
        process.env.TH_LOW = '8'
      })

      after(function () {
        delete process.env.TH_HIGH
        delete process.env.TH_LOW
      })

      it('should be able to set thresholds from env', async function () {
        const flow = [
          {
            id: 'n1',
            type: 'bang-bang',
            name: 'bangbangNode',
            thresholdUpperType: 'env',
            thresholdUpper: 'TH_HIGH',
            thresholdLowerType: 'env',
            thresholdLower: 'TH_LOW',
            wires: [['n2']]
          },
          { id: 'n2', type: 'helper' }
        ]
        await loadFlow(bangbangNode, flow)

        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')

        await testHysteresisAsync(n1, n2)
      })
    })

    it('should report invalid JSONata in threshold', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpperType: 'jsonata',
          thresholdUpper: '$.payload +',
          thresholdLower: 8
        }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')

      n1.receive({ payload: 11 })
      const call = await promiseNodeCallback(n1, 'call:error').should.be.resolved()
      call.should.been.calledWithMatch(/Invalid expression used as threshold: .+/)
    })
  })

  describe('set outputs', function () {
    it('should be able to set output to msg property', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'msg',
          outputHigh: 'prop1',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11, prop1: 'val1' }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to nested msg property', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          property: 'payload.value',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'msg',
          outputHigh: 'payload.value',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: { value: 11 } }).should.be.resolved()
      msg.should.have.property('payload', 11)
    })

    it('should be able to set output to flow variable', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'flow',
          outputHigh: 'var1',
          wires: [['n2']],
          z: 'flow'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.context().flow.set('var1', 'val1')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to global variable', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'global',
          outputHigh: 'var1',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.context().global.set('var1', 'val1')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to string', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'str',
          outputHigh: 'val1',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 'val1')
    })

    it('should be able to set output to number', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'num',
          outputHigh: '42',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 42)
    })

    it('should be able to set output to boolean', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'bool',
          outputHigh: true,
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', true)
    })

    it('should be able to set output to JSON', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'json',
          outputHigh: '{"key": "value"}',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload')
      msg.payload.should.have.property('key', 'value')
    })

    it('should be able to set output to Buffer', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'bin',
          outputHigh: '[104, 101, 108, 108, 111]',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', Buffer.from([104, 101, 108, 108, 111]))
    })

    it('should be able to set output to JSONata', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'jsonata',
          outputHigh: '$.payload + 31',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()
      msg.should.have.property('payload', 42)
    })

    it('should be able to set output to original message', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'pay',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      const msg = await promiseNodeResponse(n1, n2, { payload: 11, prop1: 'val1' }).should.be.resolved()
      msg.should.have.property('payload', 11)
      msg.should.have.property('prop1', 'val1')
    })

    it('should be able to set output to nothing', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'nul',
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should disable output if numeric value is unparseable', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'num',
          outputHigh: 'bug'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.error.should.be.calledWithMatch(/Invalid output expression for rising edge.+/)

      n1.should.have.property('valid', false)
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should disable output if JSON expression is invalid', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputLowType: 'json',
          outputLow: '{"key": "value"'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.error.should.be.calledWithMatch(/Invalid output expression for falling edge.+/)

      n1.should.have.property('valid', false)
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should disable output if Buffer expression is invalid', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputLowType: 'bin',
          outputLow: '[95, 96, 97, 98'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.error.should.be.calledWithMatch(/Invalid output expression for falling edge.+/)

      n1.should.have.property('valid', false)
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should disable output if JSONata expression is invalid', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'jsonata',
          outputHigh: '$.payload +'
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      n1.error.should.be.calledWithMatch(/Invalid output expression for rising edge.+/)

      n1.should.have.property('valid', false)
      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.rejectedWith('timeout')
    })

    it('should warn if output could not be calculated', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          outputHighType: 'jsonata',
          outputHigh: '$.payloat + 31'
        }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')

      n1.receive({ payload: 11 })
      const call = await promiseNodeCallback(n1, 'call:warn').should.be.resolved()
      call.should.been.calledWithExactly('Output could not be calculated')
    })

    // TODO env
  })

  describe('set status', function () {
    it('should set proper status by default', async function () {
      const flow = [
        { id: 'n1', type: 'bang-bang', name: 'bangbangNode' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')

      n1.status.should.be.calledWithExactly({ fill: 'grey', shape: 'dot', text: 'undefined' })
    })

    it('should set proper status on low output', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      await promiseNodeResponse(n1, n2, { payload: 7 }).should.be.resolved()

      n1.status.should.be.calledWithExactly({ fill: 'blue', shape: 'dot', text: 'low' })
    })

    it('should set proper status on high output', async function () {
      const flow = [
        {
          id: 'n1',
          type: 'bang-bang',
          name: 'bangbangNode',
          thresholdUpper: 10,
          thresholdLower: 8,
          wires: [['n2']]
        },
        { id: 'n2', type: 'helper' }
      ]
      await loadFlow(bangbangNode, flow)

      const n1 = helper.getNode('n1')
      const n2 = helper.getNode('n2')

      await promiseNodeResponse(n1, n2, { payload: 11 }).should.be.resolved()

      n1.status.should.be.calledWithExactly({ fill: 'red', shape: 'dot', text: 'high' })
    })
  })
})
