module.exports = function (RED) {
  class BangBangNode {
    constructor (config) {
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

      this.on('input', this.onInput)

      this.init()
    }

    init () {
      this.status({
        fill: (this.state === 'undefined' ? 'grey' : (this.state === 'high' ? 'red' : 'blue')),
        shape: 'dot',
        text: this.state
      })

      // TODO: send initial message
    }

    onInput (msg) {
      const propertyValue = RED.util.getMessageProperty(msg, this.property)
      if (propertyValue === undefined) {
        // skip message with no payload property
        this.error(`Message has no property "${this.property}"`)
        return
      }
      const currentValue = Number(propertyValue)
      if (isNaN(currentValue)) {
        this.error('Property is not a number')
        return
      }

      let thresholdRisingValue, thresholdFallingValue
      try {
        thresholdRisingValue = RED.util.evaluateNodeProperty(this.thresholdRising, this.thresholdRisingType, this)
        thresholdFallingValue = RED.util.evaluateNodeProperty(this.thresholdFalling, this.thresholdFallingType, this)
      } catch (err) {
        this.error(`Invalid expression used as threshold: "${err.message}"`)
      }

      // TODO: debug/trace logging
      // RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
      //   state: this.state,
      //   inputValue: currentValue,
      //   thresholdRising: thresholdRisingValue,
      //   thresholdFalling: thresholdFallingValue
      // })});

      var stateChanged = false
      if (this.state !== 'low' && currentValue < thresholdFallingValue) {
        stateChanged = true
        this.state = 'low'
      } else if (this.state !== 'high' && currentValue > thresholdRisingValue) {
        stateChanged = true
        this.state = 'high'
      }

      if (stateChanged) {
        this.status({ fill: (this.state === 'high' ? 'red' : 'blue'), shape: 'dot', text: this.state })

        let payload, payloadType
        if (this.state === 'high') {
          payload = this.outputHigh
          payloadType = this.outputHighType
        } else /* if (this.state === "low") */ {
          payload = this.outputLow
          payloadType = this.outputLowType
        }

        let msgOut
        if (payloadType === 'nul') {
          msgOut = null
        } else if (payloadType === 'pay') {
          msgOut = msg
        } else if (payloadType === 'msg' || payloadType === 'jsonata') {
          msgOut = { payload: RED.util.evaluateNodeProperty(payload, payloadType, this, msg) }
        } else {
          msgOut = { payload: RED.util.evaluateNodeProperty(payload, payloadType, this) }
        }

        this.send(msgOut)
      }
    }
  }

  RED.nodes.registerType('bang-bang', BangBangNode)
}
