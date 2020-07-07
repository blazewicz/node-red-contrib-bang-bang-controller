module.exports = function (RED) {
  function BangBangNode (config) {
    RED.nodes.createNode(this, config)

    this.property = config.property || 'payload'
    this.propertyType = config.propertyType || 'msg'
    this.thresholdRising = config.thresholdRising
    this.thresholdRisingType = config.thresholdRisingType || 'num'
    this.thresholdFalling = config.thresholdFalling
    this.thresholdFallingType = config.thresholdFallingType || 'num'
    this.outputHigh = config.outputHigh || true
    this.outputHighType = config.outputHighType || 'bool'
    this.outputLow = config.outputLow || false
    this.outputLowType = config.outputLowType || 'bool'
    this.state = config.initialState || 'undefined'

    this.status({
      fill: (this.state === 'undefined' ? 'grey' : (this.state === 'high' ? 'red' : 'blue')),
      shape: 'dot',
      text: this.state
    })

    // TODO: send initial message

    const node = this
    this.on('input', function (msg) {
      if (!Object.prototype.hasOwnProperty.call(msg, node.property)) {
        node.error('Message has no property ...')
        return
      }
      const propertyValue = RED.util.evaluateNodeProperty(node.property, node.propertyType, node, msg)
      // TODO: better validation if property is a number
      const currentValue = Number(propertyValue)
      if (isNaN(currentValue)) {
        node.error('Property is not a number')
        return
      }

      let thresholdRisingValue, thresholdFallingValue
      try {
        thresholdRisingValue = RED.util.evaluateNodeProperty(node.thresholdRising, node.thresholdRisingType, node)
        thresholdFallingValue = RED.util.evaluateNodeProperty(node.thresholdFalling, node.thresholdFallingType, node)
      } catch (err) {
        node.error(`Invalid expression used as threshold: "${err.message}"`)
      }

      // TODO: debug/trace logging
      // RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
      //   state: node.state,
      //   inputValue: currentValue,
      //   thresholdRising: thresholdRisingValue,
      //   thresholdFalling: thresholdFallingValue
      // })});

      var stateChanged = false
      if (node.state !== 'low' && currentValue < thresholdFallingValue) {
        stateChanged = true
        node.state = 'low'
      } else if (node.state !== 'high' && currentValue > thresholdRisingValue) {
        stateChanged = true
        node.state = 'high'
      }

      if (stateChanged) {
        node.status({ fill: (node.state === 'high' ? 'red' : 'blue'), shape: 'dot', text: node.state })

        let payload, payloadType
        if (node.state === 'high') {
          payload = node.outputHigh
          payloadType = node.outputHighType
        } else /* if (node.state === "low") */ {
          payload = node.outputLow
          payloadType = node.outputLowType
        }

        let msgOut
        if (payloadType === 'nul') {
          msgOut = null
        } else if (payloadType === 'pay') {
          msgOut = msg
        } else if (payloadType === 'msg' || payloadType === 'jsonata') {
          msgOut = { payload: RED.util.evaluateNodeProperty(payload, payloadType, node, msg) }
        } else {
          msgOut = { payload: RED.util.evaluateNodeProperty(payload, payloadType, node) }
        }

        node.send(msgOut)
      }
    })
  }

  RED.nodes.registerType('bang-bang', BangBangNode)
}
