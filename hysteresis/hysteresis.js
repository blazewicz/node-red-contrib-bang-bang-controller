module.exports = function(RED) {
  function HysteresisNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;
    node.state = config.initialState;

    // let thresholdRising = RED.util.evaluateNodeProperty(config.thresholdRising, config.thresholdRisingType, node);
    // let thresholdFalling = RED.util.evaluateNodeProperty(config.thresholdFalling, config.thresholdFallingType, node);

    // RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
    //   thresholdRising: thresholdRising,
    //   thresholdFalling: thresholdFalling
    // })});

    node.on('input', function(msg) {
      let property;
      if (config.propertyType === "msg") {
        // TODO: fix this "SyntaxError: JSON.parse"
        if (!msg.hasOwnProperty(config.property)) {
          RED.comms.publish("debug", {format: "error", msg: "Message has no property"})
          return;
        }
        property = RED.util.evaluateNodeProperty(config.property, config.propertyType, node, msg);
      } else if (config.propertyType === "jsonata") {
        property = RED.util.evaluateNodeProperty(config.property, config.propertyType, node, msg);
      } else {
        // adding `msg` causes error
        property = RED.util.evaluateNodeProperty(config.property, config.propertyType, node);
      }
      // TODO: validate is number
      let current_value = Number(property);
      if (isNaN(current_value)) {
        RED.comms.publish("debug", {format: "error", msg: "Not a number property"});
        return;
      }

      let thresholdRisingValue = RED.util.evaluateNodeProperty(config.thresholdRising, config.thresholdRisingType, node);
      let thresholdFallingValue = RED.util.evaluateNodeProperty(config.thresholdFalling, config.thresholdFallingType, node);

      RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
        state: node.state,
        inputValue: current_value,
        thresholdRising: thresholdRisingValue,
        thresholdFalling: thresholdFallingValue
      })});

      var stateChanged = false;
      if (node.state === "high" && current_value < thresholdFallingValue) {
        stateChanged = true;
        node.state = "low";
      } else if (node.state === "low" && current_value > thresholdRisingValue) {
        stateChanged = true;
        node.state = "high";
      }

      if (stateChanged) {
        let payload, payloadType;
        if (node.state === "high") {
          payload = config.outputHigh;
          payloadType = config.outputHighType;
        } else /* (node.state === "low") */ {
          payload = config.outputLow;
          payloadType = config.outputLowType;
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
