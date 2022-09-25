import { aws_codebuild, aws_codepipeline, aws_codepipeline_actions, aws_s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudfrontInvalidation } from '../cloudfront-invalidation/index';
import { S3EmptyBucket } from '../s3-empty-bucket/index';

export interface BuildDeployStaticWebsiteProps {
   /**
    * Input source for build.
    *
    * Recommend to use ``` BuildDeployStaticWebsiteSource ```, which is a simple wrapper class for easy use of SourceActions.
    *
    * Also, you can directly use ``` SourceActions ``` in ``` aws_codepipeline_actions ```
    */
   readonly source:
      | aws_codepipeline_actions.S3SourceAction
      | aws_codepipeline_actions.EcrSourceAction
      | aws_codepipeline_actions.GitHubSourceAction
      | aws_codepipeline_actions.CodeCommitSourceAction
      | aws_codepipeline_actions.CodeStarConnectionsSourceAction;
   /**
    * Installation scripts to run in CodeBuild before the regular commands
    */
   readonly installCommands: string[];
   /**
    * Main scripts to run in CodeBuild.
    */
   readonly buildCommands: string[];
   /**
    * Destination S3 bucket. The build output files will be deployed to this bucket.
    *
    * @caution The bucket will be cleaned up before deployment. Be sure this bucket is only used for this.
    */
   readonly destinationBucket: aws_s3.IBucket;
   /**
    * Id of distribution in Cloudfront, using ```destinationBucket``` as an origin.
    *
    * If this value is set, all files in the distribution's edge caches will be invalidated after the deployment of build output.
    * @default - no CloudFront invalidation.
    */
   readonly cloudfrontDistributionId?: string;
   /**
    * The directory that will contain output files.
    *
    * After running the script, the contents of the given directory will be deployed to S3.
    * @default "build"
    */
   readonly primaryOutputDirectory?: string;
   /**
    * If you want to exclude some files from build output, use this property.
    *
    * Represents one or more paths, relative to ```primaryOutputDirectory```, that CodeBuild will exclude from output.
    * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec.artifacts.exclude-paths
    */
   readonly primaryOutputExcludePaths?: string[];
   /**
    * The build image used for CodeBuild.
    * @default aws_codebuild.LinuxBuildImage.STANDARD_6_0
    */
   readonly buildImage?: aws_codebuild.IBuildImage;
   /**
    * The compute type to use for CodeBuild.
    * @default aws_codebuild.ComputeType.SMALL
    */
   readonly computeType?: aws_codebuild.ComputeType;
   /**
    * Runtime versions for CodeBuild.
    * Currently, only nodejs available.
    */
   readonly runtimeVersions?: {
      /**
       * Nodejs version
       * @default 16
       */
      readonly nodejs: 14 | 16;
   };
   /**
    * The environment variables pass to CodeBuild.
    * If the variable with same name exists in build project, this value will get priority.
    */
   readonly environmentVariables?: { [name: string]: aws_codebuild.BuildEnvironmentVariable };
   /**
    * Whether to re-run CodePipeline of this ```BuildDeployStaticWebsite``` procedure, when you update it.
    * @default false
    */
   readonly restartExecutionOnUpdate?: boolean;
}

/**
 * Simple custom CodePipeline for build static website and deploy to s3, also support cloudfront invalidation.
 *
 * It enables to make independent CodePipeline for frontend and use environment variables referencing other cdk resources.
 */
export class BuildDeployStaticWebsite extends Construct {
   /**
    * Simple custom CodePipeline for build static website and deploy to s3, also support cloudfront invalidation.
    *
    * It enables to make independent CodePipeline for frontend and use environment variables referencing other cdk resources.
    */
   constructor(scope: Construct, id: string, props: BuildDeployStaticWebsiteProps) {
      super(scope, id);

      const buildProject = new aws_codebuild.Project(this, 'BuildProject', {
         environment: {
            buildImage: props.buildImage ?? aws_codebuild.LinuxBuildImage.STANDARD_6_0,
            computeType: props.computeType ?? aws_codebuild.ComputeType.SMALL,
         },
         buildSpec: aws_codebuild.BuildSpec.fromObject({
            version: 0.2,
            phases: {
               install: {
                  'runtime-versions': props.runtimeVersions ?? { nodejs: 16 },
                  commands: props.installCommands,
               },
               build: {
                  commands: props.buildCommands,
               },
            },
            artifacts: {
               'base-directory': props.primaryOutputDirectory ?? 'build',
               'exclude-paths': props.primaryOutputExcludePaths,
               files: '**/*',
            },
         }),
         grantReportGroupPermissions: false,
      });

      const pipeline = new aws_codepipeline.Pipeline(this, 'Pipeline', { restartExecutionOnUpdate: props.restartExecutionOnUpdate ?? false });

      pipeline.addStage({
         stageName: 'Source',
         actions: [props.source],
      });
      if (!props.source.actionProperties?.outputs?.[0]) throw Error('source input does not have output artifact. please check your source is correctly set.');

      const buildOutput = new aws_codepipeline.Artifact('BuildArtifact');
      pipeline.addStage({
         stageName: 'Build',
         actions: [
            new aws_codepipeline_actions.CodeBuildAction({
               actionName: 'CodeBuildAction',
               input: props.source.actionProperties.outputs[0],
               environmentVariables: props.environmentVariables,
               project: buildProject,
               outputs: [buildOutput],
               checkSecretsInPlainTextEnvVariables: true,
            }),
         ],
      });

      pipeline.addStage({
         stageName: 'PreDeploy',
         actions: [
            new aws_codepipeline_actions.StepFunctionInvokeAction({
               actionName: 'StepFunctionInvokeAction',
               stateMachine: new S3EmptyBucket(this, 'S3EmptyBucket', {
                  bucketArn: props.destinationBucket.bucketArn,
                  bucketName: props.destinationBucket.bucketName,
               }).stateMachine,
            }),
         ],
      });

      pipeline.addStage({
         stageName: 'Deploy',
         actions: [new aws_codepipeline_actions.S3DeployAction({ actionName: 'S3DeployAction', input: buildOutput, bucket: props.destinationBucket })],
      });

      if (props.cloudfrontDistributionId) {
         pipeline.addStage({
            stageName: 'Invalidation',
            actions: [
               new aws_codepipeline_actions.StepFunctionInvokeAction({
                  actionName: 'StepFunctionInvokeAction',
                  stateMachine: new CloudfrontInvalidation(this, 'CloudfrontInvalidation', { cloudfrontDistributionId: props.cloudfrontDistributionId })
                     .stateMachine,
               }),
            ],
         });
      }
   }
}
