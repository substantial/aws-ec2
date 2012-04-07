var config = require('./config.js'),
	aws = require('../index.js')(config.accessKey, config.secretAccessKey),
	should = require('should');

//These tests launch actual amazon instances which cost money to run, use them wisely.
describe('If I issue a request to add a valid ami', function () {
	var instanceId,
		instance;
	it('I should get back a valid response', function (done) {
		var options = {
			'ami':config.ami,
			'awsZone':config.awsZone,
			'instanceType':config.instanceType,
			'securityGroups':config.securityGroups
		};
		aws.launchOnDemandInstances(1, options, function (err, response) {

			should.not.exist(err);
			instanceId = response.item.instanceId;
			instanceId.should.not.be.empty;
			done();
		});
	});
	describe('If you request a description of that instance based on Id', function () {
		it('should match the id you got from the launch request', function (done) {
			aws.getInstanceDescriptionFromId(instanceId, function (err, response) {
				should.not.exist(err);
				instance = response;
				instance.instanceId.should.eql(instanceId);
				done();
			})
		})
		it('should show that it launched in the correct zone', function (done) {
			instance.placement.availabilityZone.should.eql(config.awsZone);
			done();
		});
		it('should show that it launched in the correct groups', function (done) {
			var instGroups = instance.groupSet.item;
			var configGroups = config.securityGroups;
			instGroups.length.should.eql(configGroups.length);
			//TODO: aws returns the groups in alpha order, if the groups in the config
			//are not in alpha order this will fail
			for (var i = 0; i < configGroups.length; i++) {
				configGroups[i].should.eql(instGroups[i].groupName);
			}
			done();
		})
	});
	describe('If you request to terminate the instance I just launched', function () {
		it('should have a new status of shutting down', function (done) {
			aws.terminateEc2Instance(instanceId, function (err, response) {
				should.not.exist(err);
				done();
			});
		});
	});
});


describe('If I issue a request to launch a spot instance', function () {
	var spotRequestId;
	it('should give me back a response containing my requestId', function (done) {
		var options = {
					'ami':config.ami,
					'awsZone':config.awsZone,
					'instanceType':config.instanceType,
					'securityGroups':config.securityGroups,
					'spotPrice':config.spotPrice
				};
		aws.launchSpotInstances(1, options, function (err, response) {
			should.not.exist(err);
			spotRequestId = response.spotInstanceRequestId;
			spotRequestId.should.not.be.empty;
			done();
		});
	});
	describe('If I issue a request to cancel the request I just made', function() {
		it('Should not return an error', function(done){
			aws.cancelSpotRequest(spotRequestId,function(err,response){
				should.not.exist(err);
				done();
			});
		});
	});
	describe('If I then request a description of that same spot request', function(){
		it('Should return a description with a status of cancelled', function(done){
			aws.describeSpotInstanceRequest(spotRequestId,function(err,response){
				should.not.exist(err);
				response.state.should.eql('cancelled');
				done();
			})
		})
	})
});
