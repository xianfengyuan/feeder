module.exports = {
    "CloudFormation": {
        "cf": ["describeStackResources", "StackName", "StackResources", 1]
    },
    "Route53": {
        "zone": ["listHostedZones", "MaxItems", "HostedZones"],
        "dns": ["listResourceRecordSets", "HostedZoneId", "ResourceRecordSets", 1]
    },
    "EC2": {
        "status": ["describeInstanceStatus", "InstanceIds", "InstanceStatuses"],
        "AWS::EC2::Instance": ["describeInstances", "InstanceIds", "Reservations"],
        "AWS::EC2::SecurityGroup": ["describeSecurityGroups", "GroupIds", "SecurityGroups"],
        "AWS::EC2::VPC": ["describeVpcs", "VpcIds", "Vpcs"],
        "AWS::EC2::EIP": ["describeAddresses", "PublicIps", "Addresses"],
        "AWS::EC2::Subnet": ["describeSubnets", "SubnetIds", "Subnets"]
    },
    "RDS": {
        "AWS::RDS::DBSubnetGroup": ["describeDBSubnetGroups", "DBSubnetGroupName", "DBSubnetGroups", 1],
        "AWS::RDS::DBInstance": ["describeDBInstances", "DBInstanceIdentifier", "DBInstances", 1]
    },
    "OpsWorks": {
        "stack": ["describeStacks", "StackIds", "Stacks"],
        "app": ["describeApps", "AppIds", "Apps"],
        "deploy": ["describeDeployments", "AppId", "Deployments", 1],
        "stackinstance": ["describeInstances", "StackId", "Instances", 1],
        "layer": ["describeLayers", "LayerIds", "Layers"]
    },
    "ELB": {
        "health": ["describeInstanceHealth", "LoadBalancerName", "InstanceStates", 1],
        "elb": ["describeLoadBalancers", "LoadBalancerNames", "LoadBalancerDescriptions"]
    },
    "ElastiCache": {
        "AWS::ElastiCache::CacheCluster": ["describeCacheClusters", "CacheClusterId", "CacheClusters", 1]
    },
    "CloudWatch": {
        "alarm": ["describeAlarms", "AlarmNames", "MetricAlarms"]
    }
};

