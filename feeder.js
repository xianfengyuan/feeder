var async = require('async');
var AWS = require('aws-sdk');
var fs = require('fs');

var config = require('./configs/config');
var aws = require('./services/aws');

var interval = config.interval * 1000;
var cacheList = {
//  caching: [aws.getAllCFs, ''],
//  dns: [aws.getZoneRR, 'us-east-1'],
  deployments: [aws.listStackStuff, ['describeDeployments', 'Deployments']],
  opsapps: [aws.listStackStuff, ['describeApps', 'Apps']],
  opselbs: [aws.listStackStuff, ['describeElasticLoadBalancers', 'ElasticLoadBalancers']],
  opsints: [aws.listStackStuff, ['describeInstances', 'Instances']],
  opslays: [aws.listStackStuff, ['describeLayers', 'Layers']],
  opsworks: [aws.listOpsWorks, 'us-east-1'],
  ec2status: [aws.getEvents, ''],
  ec2grp: [aws.getGrp, '']
};

function getCache(key) {
  console.log(key + ': started...');
  var cache = {dev: ''};
  async.map(Object.keys(cache), function(a, callback) {
    cacheList[key][0](a, cacheList[key][1], function(err, data) {
      callback(err, {a: a, cache: data});
    });
  }, function(err, results) {
    if (err) {
      return console.log({message: key + ': ' + err.message});
    }
    for (var i = 0; i < results.length; i++) {
      cache[results[i].a] = results[i].cache;
    }
    fs.writeFile(config.gdir(key), JSON.stringify({cache: cache}), function(err) {
      if (err) {
	return console.log({message: key + ': ' + err.message});
      }
      console.log(key + ': done.');
    });
  });
}

function cacheEach(key, callback) {
  getCache(key);
  setInterval(function() {
    getCache(key);
  }, interval);
  callback(null, key + ': timer done.');
}

async.eachSeries(Object.keys(cacheList), cacheEach, function(err) {
  if (err) {
    console.log('error caching series: ' + err.message);
  }
  console.log('Initial caching done.');
});
