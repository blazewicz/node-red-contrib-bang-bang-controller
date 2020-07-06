var helper = require("node-red-node-test-helper");
var hysteresisNode = require("../hysteresis/hysteresis.js");

describe('hysteresis node', function () {

  beforeEach(function(done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload();
    helper.stopServer(done);
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

      var c = 0;
      n2.on("input", function (msg) {
        try {
          if (c == 0) {
            msg.should.have.property('payload', false);
            n1.should.have.property('state', 'low');
            n1.receive({payload: 11});
            c += 1;
          } else if (c == 1) {
            msg.should.have.property('payload', true);
            n1.should.have.property('state', 'high');
            done()
          }
        } catch (err) {
          done(err);
        }
      });
      n1.receive({payload: 7});
    });
  });

  // it('should be able to set thresholds from flow context', function (done) {
  //   var flow = [
  //     {
  //       id: "n1",
  //       type: "hysteresis",
  //       name: "hysteresisNode",
  //       thresholdRisingType: "flow",
  //       thresholdRising: "th_high",
  //       thresholdFallingType: "flow",
  //       thresholdFalling: "th_low"
  //     }
  //   ];
  //   helper.load(hysteresisNode, flow, function () {
  //     var n1 = helper.getNode("n1");
  //
  //     n1.should.have.property('thresholdRising', 'th_high');
  //     n1.should.have.property('thresholdRisingType', 'flow');
  //     n1.should.have.property('thresholdFalling', 'th_low');
  //     n1.should.have.property('thresholdFallingType', 'flow');
  //   });
  // });
});
