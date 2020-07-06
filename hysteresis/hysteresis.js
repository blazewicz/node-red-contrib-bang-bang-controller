module.exports = function(RED) {
  function HysteresisNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;
    node.state = config.initialState;
    node.status({
      fill: (node.state === "undefined" ? "grey" : (node.state == "high" ? "red" : "blue")),
      shape: "dot",
      text: node.state
    });

    // TODO: send initial message

    node.on('input', function(msg) {
      // TODO: fix this "SyntaxError: JSON.parse"
      if (!msg.hasOwnProperty(config.property)) {
        RED.comms.publish("debug", {format: "error", msg: "Message has no property"})
        return;
      }
      let propertyValue = RED.util.evaluateNodeProperty(config.property, config.propertyType, node, msg);
      // TODO: validate is number
      let currentValue = Number(propertyValue);
      if (isNaN(currentValue)) {
        RED.comms.publish("debug", {format: "error", msg: "Not a number property"});
        return;
      }

      let thresholdRisingValue = RED.util.evaluateNodeProperty(config.thresholdRising, config.thresholdRisingType, node);
      let thresholdFallingValue = RED.util.evaluateNodeProperty(config.thresholdFalling, config.thresholdFallingType, node);

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
          payload = config.outputHigh;
          payloadType = config.outputHighType;
        } else /* if (node.state === "low") */ {
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
