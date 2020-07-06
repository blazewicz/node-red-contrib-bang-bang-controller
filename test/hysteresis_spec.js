var assert = require('assert');
var helper = require("node-red-node-test-helper");
var Context = require("@node-red/runtime/lib/nodes/context");
var hysteresisNode = require("../hysteresis/hysteresis.js");

describe('hysteresis node', function () {

  beforeEach(function(done) {
    helper.startServer(done);
  });

  afterEach(function(done) {
    helper.unload().then(function () {
        return Context.clean({allNodes: {}});
    }).then(function () {
        return Context.close();
    }).then(function () {
        helper.stopServer(done);
    });
  });

  it('should be loaded with correct defaults', function (done) {
    var flow = [{ id: "n1", type: "hysteresis", name: "hysteresisNode" }];
    helper.load(hysteresisNode, flow, function () {
      var n1 = helper.getNode("n1");
      n1.should.have.property('name', 'hysteresisNode');
      n1.should.have.property('propertyType', 'msg');
      n1.should.have.property('property', 'payload');
      n1.should.have.property('thresholdRising', undefined);
      n1.should.have.property('thresholdRisingType', 'num');
      n1.should.have.property('thresholdFalling', undefined);
      n1.should.have.property('thresholdFallingType', 'num');
      n1.should.have.property('outputHigh', true);
      n1.should.have.property('outputHighType', 'bool');
      n1.should.have.property('outputLow', false);
      n1.should.have.property('outputLowType', 'bool');
      n1.should.have.property('state', 'undefined');
      done();
    });
  });

  it('should be able to set initial state', function (done) {
    var flow = [{ id: "n1", type: "hysteresis", name: "hysteresisNode", initialState: 'low' }];
    helper.load(hysteresisNode, flow, function () {
      var n1 = helper.getNode("n1");
      n1.should.have.property('state', 'low');
      done();
    });
  });

  it('should be able to set thresholds to numbers', function (done) {
    var flow = [
      { id: "n1", type: "hysteresis", name: "hysteresisNode", thresholdRising: 10, thresholdFalling: 8, wires: [["n2"]] },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      var n1 = helper.getNode("n1");
      var n2 = helper.getNode("n2");

      n1.should.have.property('thresholdRising', 10);
      n1.should.have.property('thresholdRisingType', 'num');
      n1.should.have.property('thresholdFalling', 8);
      n1.should.have.property('thresholdFallingType', 'num');

      testHysteresis(n1, n2, done);
    });
  });

  it('should be able to set thresholds from flow context', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRisingType: "flow",
        thresholdRising: "th_high",
        thresholdFallingType: "flow",
        thresholdFalling: "th_low",
        wires: [["n2"]],
        "z": "flow"
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n1.context().flow.set("th_low", 8);
      n1.context().flow.set("th_high", 10);

      testHysteresis(n1, n2, done);
    });
  });

  it('should be able to set thresholds from global context', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRisingType: "global",
        thresholdRising: "th_high",
        thresholdFallingType: "global",
        thresholdFalling: "th_low",
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n1.context().global.set("th_low", 8);
      n1.context().global.set("th_high", 10);

      testHysteresis(n1, n2, done);
    });
  });

  describe('env var', function () {
    before(function() {
      process.env.TH_HIGH = '10';
      process.env.TH_LOW = '8';
    });
    after(function() {
      delete process.env.TH_HIGH;
      delete process.env.TH_LOW;
    });
    it('should be able to set thresholds from env', function (done) {
      let flow = [
        {
          id: "n1",
          type: "hysteresis",
          name: "hysteresisNode",
          thresholdRisingType: "env",
          thresholdRising: "TH_HIGH",
          thresholdFallingType: "env",
          thresholdFalling: "TH_LOW",
          wires: [["n2"]]
        },
        { id: "n2", type: "helper" }
      ];
      helper.load(hysteresisNode, flow, function () {
        let n1 = helper.getNode("n1");
        let n2 = helper.getNode("n2");

        testHysteresis(n1, n2, done);
      });
    });
  });

  it('should be able to set output to msg property', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRising: 10,
        thresholdFalling: 8,
        outputHighType: "msg",
        outputHigh: "prop1",
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n2.on("input", function (msg) {
        try {
          msg.should.have.property('payload', 'val1');
          done();
        } catch (err) {
          done(err);
        }
      });

      n1.receive({payload: 11, prop1: 'val1'});
    });
  });

  it('should be able to set output to flow variable', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRising: 10,
        thresholdFalling: 8,
        outputHighType: "flow",
        outputHigh: "var1",
        wires: [["n2"]],
        "z": "flow"
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n1.context().flow.set("var1", "val1");

      n2.on("input", function (msg) {
        try {
          msg.should.have.property('payload', 'val1');
          done();
        } catch (err) {
          done(err);
        }
      });

      n1.receive({payload: 11});
    });
  });

  it('should be able to set output to global variable', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRising: 10,
        thresholdFalling: 8,
        outputHighType: "global",
        outputHigh: "var1",
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n1.context().global.set("var1", "val1");

      n2.on("input", function (msg) {
        try {
          msg.should.have.property('payload', 'val1');
          done();
        } catch (err) {
          done(err);
        }
      });

      n1.receive({payload: 11});
    });
  });

  it('should be able to set output to original message', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRising: 10,
        thresholdFalling: 8,
        outputHighType: "pay",
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n2.on("input", function (msg) {
        try {
          msg.should.have.property('payload', 11);
          msg.should.have.property('prop1', 'val1');
          done();
        } catch (err) {
          done(err);
        }
      });

      n1.receive({payload: 11, prop1: 'val1'});
    });
  });

  it('should be able to set output to nothing', function (done) {
    let flow = [
      {
        id: "n1",
        type: "hysteresis",
        name: "hysteresisNode",
        thresholdRising: 10,
        thresholdFalling: 8,
        outputHighType: "nul",
        wires: [["n2"]]
      },
      { id: "n2", type: "helper" }
    ];
    helper.load(hysteresisNode, flow, function () {
      let n1 = helper.getNode("n1");
      let n2 = helper.getNode("n2");

      n2.on("input", function (msg) {
        try {
          assert.fail("should not get a message");
        } catch (err) {
          done(err);
        }
      });

      n1.receive({payload: 11});
      setTimeout(function () {
        done();
      }, 10);
    });
  });
});

function testHysteresis(testNode, helperNode, done) {
  var c = 0;
  var c0Flag, c1Flag, c2Flag;
  helperNode.on("input", function (msg) {
    try {
      if (c == 0) {
        assert(!c0Flag, "repeated message 0");
        c0Flag = true;
        // 1b. state changes to 'low', outputLow is sent
        msg.should.have.property('payload', false);
        testNode.should.have.property('state', 'low');
        // 2a. send value in deadband
        testNode.receive({payload: 9});
        setTimeout(function() {
          try {
            // 2b. state does not change, no output is generated
            testNode.should.have.property('state', 'low');
            // 3a. send value above rising threshold
            testNode.receive({payload: 11});
            c += 1;
          } catch (err) {
            done(err);
          }
        }, 10);
      } else if (c == 1) {
        assert(!c1Flag, "repeated message 1");
        c1Flag = true;
        // 3b. state changes to 'high', outputHigh is sent
        msg.should.have.property('payload', true);
        testNode.should.have.property('state', 'high');
        // 4a. send value in deadband
        testNode.receive({payload: 9});
        setTimeout(function() {
          try {
            // 4b. state does not change, no output is generated
            testNode.should.have.property('state', 'high');
            // 5a. send value below falling threshold
            testNode.receive({payload: 7});
            c += 1;
          } catch (err) {
            done(err);
          }
        }, 10);
      } else if (c == 2) {
        assert(!c2Flag, "repeated message 2");
        c2Flag = true;
        // 5b. state changes to 'low', outputLow is sent
        msg.should.have.property('payload', false);
        testNode.should.have.property('state', 'low');
        // 6. done
        done();
      }
    } catch (err) {
      done(err);
    }
  });
  // 1a. send value below falling threshold
  testNode.receive({payload: 7});
}
