module.exports = function(RED) {
  function HysteresisNode(config) {
    RED.nodes.createNode(this, config);

    this.property = config.property || 'payload';
    this.propertyType = config.propertyType || 'msg';
    this.thresholdRising = config.thresholdRising;
    this.thresholdRisingType = config.thresholdRisingType || 'num';
    this.thresholdFalling = config.thresholdFalling;
    this.thresholdFallingType = config.thresholdFallingType || 'num';
    this.outputHigh = config.outputHigh || true;
    this.outputHighType = config.outputHighType || 'bool';
    this.outputLow = config.outputLow || false;
    this.outputLowType = config.outputLowType || 'bool';
    this.state = config.initialState || 'undefined';

    let node = this;

    node.status({
      fill: (node.state === "undefined" ? "grey" : (node.state == "high" ? "red" : "blue")),
      shape: "dot",
      text: node.state
    });

    // TODO: send initial message

    node.on('input', function(msg) {
      // TODO: fix this "SyntaxError: JSON.parse"
      if (!msg.hasOwnProperty(node.property)) {
        RED.comms.publish("debug", {format: "error", msg: "Message has no property"})
        return;
      }
      let propertyValue = RED.util.evaluateNodeProperty(node.property, node.propertyType, node, msg);
      // TODO: validate is number
      let currentValue = Number(propertyValue);
      if (isNaN(currentValue)) {
        RED.comms.publish("debug", {format: "error", msg: "Not a number property"});
        return;
      }

      let thresholdRisingValue = RED.util.evaluateNodeProperty(node.thresholdRising, node.thresholdRisingType, node);
      let thresholdFallingValue = RED.util.evaluateNodeProperty(node.thresholdFalling, node.thresholdFallingType, node);

      RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
        state: node.state,
        inputValue: currentValue,
        thresholdRising: thresholdRisingValue,
        thresholdFalling: thresholdFallingValue
      })});

      var stateChanged = false;
      if (node.state !== "low" && currentValue < thresholdFallingValue) {
        stateChanged = true;
        node.state = "low";
      } else if (node.state !== "high" && currentValue > thresholdRisingValue) {
        stateChanged = true;
        node.state = "high";
      }

      if (stateChanged) {
        node.status({fill: (node.state == "high" ? "red" : "blue"), shape: "dot", text: node.state});

        let payload, payloadType;
        if (node.state === "high") {
          payload = node.outputHigh;
          payloadType = node.outputHighType;
        } else /* if (node.state === "low") */ {
          payload = node.outputLow;
          payloadType = node.outputLowType;
        }

        if (payloadType === "msg" || payloadType === "jsonata") {
          payload = RED.util.evaluateNodeProperty(payload, payloadType, node, msg);
        } else {
          payload = RED.util.evaluateNodeProperty(payload, payloadType, node);
        }

        node.send(
          {payload: payload}
        );
      }
    });
  }

  RED.nodes.registerType('hysteresis', HysteresisNode);
}
