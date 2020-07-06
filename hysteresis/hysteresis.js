module.exports = function(RED) {
  function HysteresisNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;

    node.state = "down";

    let mode = config.mode;
    let thresholdRising = RED.util.evaluateNodeProperty(config.thresholdRising, config.thresholdRisingType, node);
    let thresholdFalling = RED.util.evaluateNodeProperty(config.thresholdFalling, config.thresholdFallingType, node);

    RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
      mode: mode,
      thresholdRising: thresholdRising,
      thresholdFalling: thresholdFalling
    })});

    node.on('input', function(msg) {
      let property = config.property;
      if (config.propertyType === "msg") {
        if (!msg.hasOwnProperty(config.property)) {
          RED.comms.publish("debug", {format: "error", msg: "Message has no property"})
        }
        property = RED.util.getMessageProperty(msg, config.property);
      }
      let current_value = Number(RED.util.evaluateNodeProperty(property, config.propertyType, node));
      if (isNaN(current_value)) {
        RED.comms.publish("debug", {format: "error", msg: "Not a number property"});
        return;
      }

      let thresholdRisingValue = RED.util.evaluateNodeProperty(config.thresholdRising, config.thresholdRisingType, node);
      let thresholdFallingValue = RED.util.evaluateNodeProperty(config.thresholdFalling, config.thresholdFallingType, node);

      RED.comms.publish("debug", {format: "Object", msg: JSON.stringify({
        mode: mode,
        state: node.state,
        inputValue: current_value,
        thresholdRising: thresholdRisingValue,
        thresholdFalling: thresholdFallingValue
      })});

      var stateChanged = false;
      if (config.mode === "falling") {
        if (node.state === "up" && current_value < thresholdFallingValue) {
          stateChanged = true;
          node.state = "down";
        }
      } else if (config.mode === "rising") {
        if (node.state === "down" && current_value > thresholdRisingValue) {
          stateChanged = true;
          node.state = "up";
        }
      } else /* if (config.mode === "hysteresis") */ {
        if (node.state === "up" && current_value < thresholdFallingValue) {
          stateChanged = true;
          node.state = "down";
        } else if (node.state === "down" && current_value > thresholdRisingValue) {
          stateChanged = true;
          node.state = "up";
        }
      }

      if (stateChanged) {
        let payload, payloadType;
        if (node.state === "up") {
          payload = config.outputHigh;
          payloadType = config.outputHighType;
        } else /* (node.state === "down") */ {
          payload = config.outputLow;
          payloadType = config.outputLowType;
        }
        if (payloadType === "msg") {
          payload = RED.util.getMessageProperty(msg, payload);
          // payload = RED.util.evaluateNodeProperty(RED.util.getMessageProperty(msg, payload), payloadType, node, msg);
        } else {
          // payload = RED.util.evaluateNodeProperty(payload, payloadType, node);
        }
        node.send(
          {payload: RED.util.evaluateNodeProperty(payload, payloadType, node)}
        );
      }
    });
  }

  RED.nodes.registerType('hysteresis', HysteresisNode);
}
