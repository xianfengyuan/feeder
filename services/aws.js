/**
 * Copyright 2015, Xianfeng Yuan.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

var Debug = require('debug');
var fs = require('fs');
var aws = require('aws-sdk');
var async = require('async');

var config = require('../configs/config');
var awscreds = require('../configs/secrets');
var services = require('../configs/awservice');

var debug = Debug('awsService');

String.prototype.inList = function (list) {
   return (list.indexOf(this.toString()) !== -1);
};

function isObjectInList(obj, list, key) {
  var ret = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i][key] === obj[key]) {
      ret = true;
      break;
    }
  }
  return ret;
}

function getAWS(account, region, service) {
  var creds = awscreds[account];
  aws.config = new aws.Config(creds);
  aws.config.region = (service === 'OpsWorks')? 'us-east-1': region;
  var ops = new aws[service]({maxRetries: 10});
  return ops;
}

function getOps(account) {
  return getAWS(account, 'us-east-1', 'OpsWorks');
}

function showAWS(account, region, service, type, id, done) {
  var ops = getAWS(account, region, service);
  var params = {};
  var s = services[service];
  if (s && s[type]) {
    if (s[type][3]) {
      params[s[type][1]] = id;
    } else {
      params[s[type][1]] = [id];
    }
    getOpsObject(ops, s[type][0], params, function(err, data) {
      if (err) {
        return done(err);
      }
      done(null, data[s[type][2]]);
    });
  } else {
    var lid = type.split('::')[2];
    params[lid + 'Ids'] = [id];
    getOpsObject(ops, 'describe' + lid + 's', params, function(err, data) {
      if (err) {
        return done(err);
      }
      done(null, data[lid + 's']);
    });
  }
}

function getOpsItem(ops, func, param, collection, attr, val, done) {
  if (ops[func] === undefined) {
    return done({message: 'no function defined: ' + func});
  }
  ops[func](param, function(err, data) {
    if (err) {
      return done(err);
    }
    
    var result = null;
    for (var i = 0; i < data[collection].length; i++) {
      var item = data[collection][i];
      if (item[attr] && (item[attr].toLowerCase() === val.toLowerCase())) {
        result = item;
      }
    }
    done(null, result);
  });
}

function getOpsItems(ops, func, param, collection, attr, vals, done) {
  var vl = vals.map(function(val) {
    return val.toLowerCase();
  });
  if (ops[func] === undefined) {
    return done({message: 'no function defined: ' + func});
  }
  ops[func](param, function(err, data) {
    if (err) {
      return done(err);
    }
    
    var results = [];
    for (var i = 0; i < data[collection].length; i++) {
      var item = data[collection][i];
      if (item[attr].toLowerCase().inList(vl)) {
        results.push(item);
      }
    }
    done(null, results);
  });
}

function getOpsObject(ops, func, param, done) {
  if (ops[func] === undefined) {
    return done({message: 'no function defined: ' + func});
  }
  ops[func](param, function(err, data){
    if (err) {
      return done(err);
    }
    done(null, data);
  });
}

function getAttrBy(account, region, ec2, attr, done) {
  showAWS(account, region, 'EC2', 'AWS::EC2::Instance', ec2, function(err, data) {
    if (err) {
      return done(err);
    }
    done(null, data[0].Instances[0][attr]);
  });
}

function getAllStacks(ops, done) {
  getOpsObject(ops, 'describeStacks', {}, function(err, data) {
    if (err) {
      return done(err);
    }
    done(null, data.Stacks);
  });
}

function getAllElbs(account, regions, done) {
  async.map(regions, function(r, done) {
    var ops = getAWS(account, r, 'ELB');
    getOpsObject(ops, 'describeLoadBalancers', {}, function(err, data) {
      if (err) {
	return done(err);
      }
      done(null, data.LoadBalancerDescriptions);
    });
  }, function(err, results) {
    if (err) {
      return done(err);
    }
    var elbs = [];
    for (var i = 0; i < results.length; i++) {
      elbs = elbs.concat(results[i]);
    }
    done(null, elbs);
  });
}

function walkCF(ops, next, last, done) {
  var list = last;
  var mytoken = next;
  (function next() {
    getOpsObject(ops, 'describeStacks', {NextToken: mytoken}, function(err, data) {
      if (err) {
	return done(err);
      }
      if (data.Stacks.length) {
	list = list.concat(data.Stacks);
      }
      if (!data.NextToken) {
	return done(null, list);
      }
      mytoken = data.NextToken;
      next();
    });
  })();
}

function getReCFs(account, region, done) {
  var reg = region || 'us-east-1';
  var ops = getAWS(account, reg, 'CloudFormation');
  var clist = [];
  getOpsObject(ops, 'describeStacks', {}, function(err, data) {
    if (err) {
      return done(err);
    }
    if (data.Stacks.length) {
      clist = clist.concat(data.Stacks);
    }
    if (!data.NextToken) {
      return done(null, clist);
    }
    walkCF(ops, data.NextToken, clist, function(err, data) {
      done(err, data);
    });
  });
}

function getAllCFs(account, region, done) {
  var rlist = region ? [region] : ['us-east-1'];
  if (rlist.length <= 1) {
    return getReCFs(account, region, done);
  }
    
  async.map(rlist, function(region, done) {
    getReCFs(account, region, done);
  }, function(err, results) {
    if (err) {
      return done(err);
    }
    var clist = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].length) clist = clist.concat(results[i]);
    }
    done(null, clist);
  });
}

function listStackStuff(account, fp, done) {
  var ops = getOps(account);
  async.waterfall([
    function start(done) {
      getAllStacks(ops, done);
    },
    function getElbs(sd, done) {
      async.mapLimit(sd, 1, function(s, done) {
        getOpsObject(ops, fp[0], {StackId: s.StackId}, function(err, data) {
          if (err) {
	    return done(err);
	  }
          done(null, {sid: s.StackId, sn: s.Name, si: data[fp[1]]});
        });
      }, function(err, results) {
        done(err, results);
      });
    }
  ], function(err, results) { 
    done(err, results);
  });
}

function getEvents(account, params, done) {
  var rlist = ['us-east-1'];
  async.map(rlist, function(region, done) {
    var ops = getAWS(account, region, 'EC2');
    getOpsObject(ops, 'describeInstanceStatus', {}, function(err, data) {
      if (err) {
	return done(err);
      }
      done(null, {r: region, d: data.InstanceStatuses});
    });
  }, function(err, results) {
    if (err) {
      return done(err);
    }
    var data = {};
    for (var i = 0; i < results.length; i++) {
      data[results[i].r] = results[i].d;
    }
    done(null, data);
  });
}

function listOpsWorks(account, region, done) {
  var ops = getOps(account);
  getOpsObject(ops, 'describeStacks', {}, function(err, data) {
    if (err) {
      return done(err);
    }
    stacks = data.Stacks.sort(function(sa, sb) {
      return (sa.Name < sb.Name) ? -1 : 1;
    });
    done(null, stacks);
  });
}

function walkRR(ops, id, name, type, lastRR, done) {
  var rrlist = lastRR;
  var myname = name, mytype = type;
  (function next() {
    getOpsObject(ops, 'listResourceRecordSets', {HostedZoneId: id, StartRecordName: myname, StartRecordType: mytype}, function(err, data) {
      if (err) {
	return done(err);
      }
      if (data.ResourceRecordSets.length) {
	rrlist = rrlist.concat(data.ResourceRecordSets);
      }
      if (!data.IsTruncated) {
	return done(null, rrlist);
      }
      myname = data.NextRecordName, mytype = data.NextRecordType;
      next();
    });
  })();
}

function getRR(ops, id, done) {
  var rrlist = [];
  getOpsObject(ops, 'listResourceRecordSets', {HostedZoneId: id}, function(err, data) {
    if (err) {
      return done(err);
    }
    if (data.ResourceRecordSets.length) {
      rrlist = rrlist.concat(data.ResourceRecordSets);
    }
    if (!data.IsTruncated) {
      return done(null, rrlist);
    }
    walkRR(ops, id, data.NextRecordName, data.NextRecordType, rrlist, function(err, data) {
      done(err, data);
    });
  });
}

function getZoneRR(account, region, done) {
  var domain = stm.domain[account];
  var ops = getAWS(account, region, 'Route53');
  getOpsItem(ops, 'listHostedZones', {}, 'HostedZones', 'Name', domain+'.', function(err, zone) {
    if (err) {
      return done(err);
    }
    if (!zone) {
      return done(null, null);
    }
    getRR(ops, zone.Id, function(err, data) {
      done(err, data);
    });
  });
}

function getGrp(account, params, done) {
  var rlist = ['us-east-1'];//, 'us-west-1'];
  async.map(rlist, function(r, done) {
    var ops = getAWS(account, r, 'EC2');
    getOpsObject(ops, 'describeSecurityGroups', {}, function(err, data) {
      if (err) {
	return allback(err);
      }
      var sec = data.SecurityGroups.map(function(e) { var ne = e; ne['r'] = r; return ne; });
      done(null, sec);
    });
  }, function(err, data) {
    if (err) {
      return done(err);
    }
    var list = [];
    for (var i = 0; i < data.length; i++) {
      list = list.concat(data[i]);
    }
    done(null, list);
  });
};

module.exports = {
  getAWS: getAWS,
  getOps: getOps,
  getOpsObject: getOpsObject,
  getOpsItems: getOpsItems,
  getOpsItem: getOpsItem,
  listStackStuff: listStackStuff,
  getAllCFs: getAllCFs,
  listOpsWorks: listOpsWorks,
  getZoneRR: getZoneRR,
  getGrp: getGrp,
  getEvents: getEvents
};
