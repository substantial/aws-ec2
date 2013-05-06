var tap = require('tap');
var test = tap.test;
var config = require('./config.js');
var aws = require('../index.js')(config.accessKey, config.secretAccessKey);
var _ = require('lodash');


test.timeout = 120;
//lengthen the timeout for tap because AWS can be slow sometimes
//console.log('timeout is: ' + process.env.TAP_TIMEOUT);
//test.timeout = 120;
test('Basic describe calls', function(t){
	t.test('Requesting a list of currently running instances', function(t){
		var filters = {};
		aws.getInstances(filters,function(err, response){
			t.notOk(err,'No error is returned');
			t.end();
		})
	});
	t.end();
});

//These tests launch actual amazon instances which cost money to run, use them wisely.
//if your tests fail double check and make sure they didn't leave any instance running


test('Launching AMIs', function(t){
	var instanceId,
		instance;
	t.test('Launching a single AMI', function(t){
		var options = {
			'numToLaunch':1,
			'ami':config.ami,
			'awsZone':config.awsZone,
			'instanceType':config.instanceType,
			'securityGroups':config.securityGroups
		};
		aws.launchOnDemandInstances(options,function(err,response){
			instanceId = response.item.instanceId;
			t.ok(instanceId, 'Response contains an instanceId');
			//Poll AWS every second to see if the instance is running yet
			//so the subsequent tests don't fail
			pollInstanceState(instanceId,['pending'],function(){
				t.end();
			});
		});
	});
	t.test('New instance should be in the list of running instances', function(t){
		var filters = {},
			instances = [];
		for (var i = 0; i < config.securityGroups.length; i++) {
			filters['Filter.' + (i + 1) + '.Name'] = 'group-name';
			filters['Filter.' + (i + 1) + '.Value.1'] = config.securityGroups[i];
		}
		aws.getInstances(filters, function (err, response) {
			for (var i = 0; i < response.length; i++) {
				instances.push(response[i].instanceId);
			}
			t.ok(instances,'Instance list is not empty');
			t.ok(_.contains(instances,instanceId),'Instance list contains the instance we just launched');
			t.end();
		});
	});
	t.test('Requesting an instance based on Id', function(t){
		aws.getInstanceDescriptionFromId(instanceId,function(err,response){
			instance = response;
			t.equal(instance.instanceId,instanceId,'got back the correct instance');
			t.end();
		});
	});
	t.test('Verify instance launched in the correct zone', function(t){
		t.equal(instance.placement.availabilityZone,config.awsZone,'zone should match config');
		t.end();
	});
	t.test('Verify instance launched in the correct groups',function(t){
		var instanceGroups = _.pluck(instance.groupSet.item,'groupName');
		var configGroups = config.securityGroups;
		t.deepEqual(instanceGroups,configGroups,'Security groups should match the groups in the config');
		t.end();
	});
	t.test('Terminate the instance', function(t){
		aws.terminateEc2Instance(instanceId,function(err,response){
			t.notOk(err,'no error');
			pollInstanceState(instanceId,['shutting-down','terminated'],function(){
				t.end();
			});
		});
	});
	t.end();
});

test('Spot requests', function(t){
	var spotRequestId;
	t.test('Issuing a spot request', function(t){
		var options = {
			'numToLaunch':1,
			'ami':config.ami,
			'awsZone':config.awsZone,
			'instanceType':config.instanceType,
			'securityGroups':config.securityGroups,
			'spotPrice':config.spotPrice
		};
		aws.launchSpotInstances(options, function (err, response) {
			spotRequestId = response.spotInstanceRequestId;
			t.ok(spotRequestId,'you get back an ID');
			t.end();
		});
	});
	t.test('Cancelling a spot request',function(t){
		aws.cancelSpotRequest(spotRequestId,function(err,response){
			t.notOk(err,'no error');
			t.end();
		});
	});
	t.test('Verify request was cancelled',function(t){
		aws.describeSpotInstanceRequest(spotRequestId,function(err,response){
			t.equal(response.state,'cancelled');
			t.end();
		});
	});
	t.end();
});

function pollInstanceState(instanceId,desiredStates,cb){
	var intervalId = setInterval(function(){
		aws.getInstanceDescriptionFromId(instanceId,function(err,response){
			if(!err){
				var instanceState = response.instanceState.name;
				if(_.contains(desiredStates,instanceState) ){
					clearInterval(intervalId);
					cb();
				}
			}
		});
	},1000);
}