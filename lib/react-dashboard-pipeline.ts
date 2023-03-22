import { ApplicationProtocol, SslPolicy } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { ServerApplication, ServerDeploymentConfig, ServerDeploymentGroup } from 'aws-cdk-lib/aws-codedeploy';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, CodeDeployServerDeployAction, GitHubSourceAction, GitHubTrigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from 'aws-cdk-lib/aws-iam'
import { ApplicationLoadBalancer, ListenerCertificate } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AutoScalingGroup, HealthCheck } from 'aws-cdk-lib/aws-autoscaling';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CicdReactAdminDashboardPipelineStack extends Stack {

    private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;
  readonly loadBalancer: ApplicationLoadBalancer;
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.pipeline = new Pipeline(this, "Pipeline",{
      pipelineName: "ReactAdminDashboardPipeline",
      crossAccountKeys: false,
      restartExecutionOnUpdate: true
    });

    const cdkSourceOutput = new Artifact("CDKSourceOutput");
    const serviceSourceOutput = new Artifact("ServiceSourceOutput");
    this.pipeline.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    )
    this.pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          owner: "rooneyviet",
          repo: "reactjs-admin-dashboard-demo",
          branch: "master",
          actionName: "Service_Source",
          oauthToken: SecretValue.secretsManager('github-pipeline2'),
          output: serviceSourceOutput,
          trigger: GitHubTrigger.WEBHOOK,
        })
      ],
    });

    this.serviceBuildOutput = new Artifact("ServiceBuildOuput");
    this.pipeline.addStage({
      stageName: "Build",
      actions:[
        new CodeBuildAction({
          actionName: "Service_Build",
          input: serviceSourceOutput,
          outputs: [this.serviceBuildOutput],
          project: new PipelineProject(this, "ServiceReactBuildProject",{
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0
            },
            buildSpec: BuildSpec.fromSourceFilename('build-specs/service-build-specs.yml')
          })
        })
      ]
    });

    


  

    this.pipeline.addStage({
      stageName: "Pipeline_Update",
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: "Pipeline_Update",
          stackName: "CicdReactAdminDashboardPipelineStack",
          templatePath: this.cdkBuildOutput.atPath("CicdReactAdminDashboardPipelineStack.template.json"),
          adminPermissions: true,
        }),
      ],
    });


    }
}