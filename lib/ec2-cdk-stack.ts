import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path';
// import { KeyPair } from 'cdk-ec2-key-pair';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';
import { ApplicationLoadBalancer, ApplicationProtocol, ListenerCertificate, SslPolicy } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { AutoScalingGroup, HealthCheck } from "aws-cdk-lib/aws-autoscaling";

import * as fs from 'fs';
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
interface ICdkEc2Props {
    //CertificateArn: string;
    //InstanceIAMRoleArn: string;
    //InstancePort: number;
    //HealthCheckPath: string;
    //HealthCheckPort: string;
    //HealthCheckHttpCodes: string;
  }

  const env = {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  };
  
export class Ec2CdkStack extends cdk.Stack {

    readonly loadBalancer: ApplicationLoadBalancer
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    //super(scope, id);
    super(scope, id, props ? props : { env });
    
    const vpc = new ec2.Vpc(this, 'VPC');
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow SSH (TCP port 22) in',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')
    securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic());

      this.loadBalancer = new ApplicationLoadBalancer(this, `ApplicationLoadBalancerPublic`, {
        vpc,
        internetFacing: true,
        securityGroup: securityGroup
      })

    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))


    const userData1 = ec2.UserData.forLinux();

    var bootscript:string;
    bootscript = fs.readFileSync('lib/src/config.sh','utf8');

    
    
    const autoScalingGroup = new AutoScalingGroup(this, 'AutoScalingGroup', {
        vpc, 
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        machineImage: new ec2.AmazonLinuxImage(), 
        allowAllOutbound: true,
        role: role,
        minCapacity:0,
        maxCapacity:1,
        desiredCapacity:1,
        healthCheck: HealthCheck.ec2(),
        associatePublicIpAddress: true,
        userData: userData1,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      });
      autoScalingGroup.addSecurityGroup(securityGroup);
    
      autoScalingGroup.addUserData(bootscript);

      const httpsListener = this.loadBalancer.addListener('ALBListenerHttps', {
        certificates: [ListenerCertificate.fromArn("arn:aws:acm:us-east-1:182854672749:certificate/736c3301-4f8e-4503-a2fc-2f980b3ceb3f")],
        protocol: ApplicationProtocol.HTTPS,
        port: 443,
        sslPolicy: SslPolicy.TLS12
      })

    httpsListener.addTargets('TargetGroup', {
        port: 80,
        protocol: ApplicationProtocol.HTTP,
        targets: [autoScalingGroup], 
        healthCheck: {
          path: "/",
          port: "80",
          healthyHttpCodes: "200"
        }
      })


      const route53_hosted_zone = HostedZone.fromLookup(this, 'MyZone', {
        domainName: 'kakiandmai.com'
      })
  
      new ARecord(this, 'AliasRecord', {
        zone: route53_hosted_zone,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(this.loadBalancer)),
        recordName: 'dashboardreact.kakiandmai.com'
      })


  }
}