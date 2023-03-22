import { Construct } from "constructs/lib/construct";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";

const WEB_APP_DOMAIN = "dashboardreactdemo.kakiandmai.com"

export class DashboardReactjsS3Stack extends cdk.Stack {

    
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);


      //[ListenerCertificate.fromArn("arn:aws:acm:us-east-1:182854672749:certificate/736c3301-4f8e-4503-a2fc-2f980b3ceb3f")],

      //Create S3 Bucket for our website
      const siteBucket = new s3.Bucket(this, "SiteBucket", {
        bucketName: WEB_APP_DOMAIN,
        websiteIndexDocument: "index.html",
        publicReadAccess: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY
    })

      const route53_hosted_zone = HostedZone.fromLookup(this, 'MyZone', {
        domainName: 'kakiandmai.com'
      })

      const myCertificate = new acm.Certificate(this, 'mySiteCert', {
        domainName: WEB_APP_DOMAIN,
        validation: acm.CertificateValidation.fromDns(route53_hosted_zone),
      });
  
      

      const cloudfrontDistri = new cloudfront.Distribution(this, 'Distribution', {
        defaultBehavior: {
          origin: new origins.S3Origin(siteBucket),
        },
        domainNames: [WEB_APP_DOMAIN],
        certificate: myCertificate,
      });

      new ARecord(this, 'AliasRecord', {
        zone: route53_hosted_zone,
        target: RecordTarget.fromAlias(new targets.CloudFrontTarget(cloudfrontDistri)),
        recordName: WEB_APP_DOMAIN
      })
  }

}
