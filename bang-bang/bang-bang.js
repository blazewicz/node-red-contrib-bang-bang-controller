const util = require('util')

module.exports = function (RED) {
  const evaluateNodeProperty = util.promisify(RED.util.evaluateNodeProperty)
  const evaluateJSONataExpression = util.promisify(RED.util.evaluateJSONataExpression)

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

      this.updateStatus()

      // TODO: send initial message

      this.valid = true

      try {
        this.outputHigh = this.prepareOutput(this.outputHigh, this.outputHighType)
      } catch (e) {
        this.error(`Invalid output expression for rising edge "${e.message}"`)
        this.valid = false
      }

      try {
        this.outputLow = this.prepareOutput(this.outputLow, this.outputLowType)
      } catch (e) {
        this.error(`Invalid output expression for falling edge "${e.message}"`)
        this.valid = false
      }

      this.on('input', this.onInput)
    }

    prepareOutput (value, type) {
      switch (type) {
        case 'num':
          return Number(value)
        case 'json':
          return JSON.parse(value)
        case 'bin':
          return Buffer.from(JSON.parse(value))
        case 'jsonata':
          return RED.util.prepareJSONataExpression(value, this)
        case 'bool':
        case 'env':
          return RED.util.evaluateNodeProperty(value, type, this)
        default:
          return value
      }
    }

    async getOutputMessage (value, type, msg) {
      switch (type) {
        case 'msg':
          return { payload: RED.util.getMessageProperty(msg, value) }
        case 'flow':
        case 'global':
          return { payload: await evaluateNodeProperty(value, type, this, msg) }
        case 'jsonata':
          return { payload: await evaluateJSONataExpression(value, msg) }
        case 'pay':
          return msg
        case 'nul':
          return null
        default:
          return { payload: value }
      }
    }

    updateStatus () {
      let fill
      switch (this.state) {
        case 'undefined':
          fill = 'grey'
          break
        case 'high':
          fill = 'red'
          break
        case 'low':
          fill = 'blue'
          break
      }

      this.status({
        fill: fill,
        shape: 'dot',
        text: this.state
      })
    }

    async onInput (msg) {
      if (!this.valid) {
        return
      }

      const propertyValue = RED.util.getMessageProperty(msg, this.property)
      if (propertyValue === undefined) {
        // ignore message with no payload property
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

      let stateChanged = false
      if (this.state !== 'low' && currentValue < thresholdFallingValue) {
        stateChanged = true
        this.state = 'low'
      } else if (this.state !== 'high' && currentValue > thresholdRisingValue) {
        stateChanged = true
        this.state = 'high'
      }

      if (stateChanged) {
        this.updateStatus()

        let payload, payloadType
        if (this.state === 'high') {
          payload = this.outputHigh
          payloadType = this.outputHighType
        } else /* if (this.state === "low") */ {
          payload = this.outputLow
          payloadType = this.outputLowType
        }

        const msgOut = await this.getOutputMessage(payload, payloadType, msg)

        if (msgOut === null) {
          // do nothing
        } else if (msgOut.payload === undefined) {
          this.warn('Output could not be calculated')
        } else {
          this.send(msgOut)
        }
      }
    }
  }

  RED.nodes.registerType('bang-bang', BangBangNode)
}
