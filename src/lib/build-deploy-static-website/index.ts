import { aws_codebuild, aws_codepipeline, aws_codepipeline_actions, aws_s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CloudfrontInvalidation } from '../cloudfront-invalidation/index';

interface BuildDeployStaticWebsiteProps {
   /**
    * input source for build. you can directly use ``` aws_codepipeline_actions.*SourceActions ```,
    * or use ``` BuildDeployStaticWebsiteSource ```, which is a simple wrapper class for easy use of SourceActions
    */
   readonly source:
      | aws_codepipeline_actions.S3SourceAction
      | aws_codepipeline_actions.EcrSourceAction
      | aws_codepipeline_actions.GitHubSourceAction
      | aws_codepipeline_actions.CodeCommitSourceAction
      | aws_codepipeline_actions.CodeStarConnectionsSourceAction;
   /**
    * installation scripts in codebuild before the regular commands
    */
   readonly installCommands: string[];
   /**
    * main scripts to run in codebuild.
    */
   readonly buildCommands: string[];
   /**
    * destination bucket. the build output files will be deployed to this bucket.
    */
   readonly destinationBucket: aws_s3.Bucket;
   /**
    * The CloudFront distribution Id.
    * If this value is set, files in the distribution's edge caches will be invalidated.
    */
   readonly cloudfrontDistributionId?: string;
   /**
    * The directory that will contain the primary output artifact.
    * After running the script, the contents of the given directory will be treated as the primary output.
    *
    *  ```ts
    * pipelines.CodePipelineSource.gitHub('owner/repo', 'main');
    * ```
    *
    * @default "build"
    */
   readonly primaryOutputDirectory?: string;
   /**
    * Represents one or more paths, relative to primaryOutputDirectory, that CodeBuild will exclude from the build artifacts.
    */
   readonly primaryOutputExcludePaths?: string[];
   /**
    * build environment for codebuild.
    */
   readonly buildEnvironment?: {
      /**
       * The image used for the builds.
       * @default aws_codebuild.LinuxBuildImage.STANDARD_6_0
       */
      readonly buildImage?: aws_codebuild.IBuildImage;
      /**
       * The type of compute to use for this build.
       * @default aws_codebuild.ComputeType.SMALL
       */
      readonly computeType?: aws_codebuild.ComputeType;
   };
   /**
    * runtime versions for codebuild.
    */
   readonly runtimeVersions?: {
      /**
       * nodejs version
       * @default 16
       */
      readonly nodejs: 8 | 10 | 12 | 14 | 16;
   };
   /**
    * The environment variables can be injected when building website.
    * If a variable with the same name was set both on the project level, and here, this value will take precedence.
    */
   readonly environmentVariables?: { [name: string]: aws_codebuild.BuildEnvironmentVariable };
   /**
    * Indicates whether to rerun the codepipeline after you update ```BuildDeployStaticWebsite``` props.
    * @default false
    */
   readonly restartExecutionOnUpdate?: boolean;
}

/**
 * simple custom codepipeline made for build static website and deploy it to s3, also support cloudfront invalidation.
 *
 * It enables to make independent pipeline for frontend build deploy, triggered by source.
 * also, it enables to use environment variables referencing cdk resources.
 */
export class BuildDeployStaticWebsite extends Construct {
   /**
    * simple custom codepipeline made for build static website and deploy it to s3, also support cloudfront invalidation.
    *
    * It enables to make independent pipeline for frontend build deploy, triggered by source.
    * also, it enables to use environment variables referencing cdk resources.
    */
   constructor(scope: Construct, id: string, props: BuildDeployStaticWebsiteProps) {
      super(scope, id);

      const buildProject = new aws_codebuild.Project(this, 'BuildProject', {
         environment: props.buildEnvironment ?? { buildImage: aws_codebuild.LinuxBuildImage.STANDARD_6_0, computeType: aws_codebuild.ComputeType.SMALL },

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

      // source
      pipeline.addStage({
         stageName: 'Source',
         actions: [props.source],
      });
      if (!props.source.actionProperties?.outputs?.[0]) throw Error('source input does not have output artifact. please check again');

      // build
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

      // deploy
      pipeline.addStage({
         stageName: 'Deploy',
         actions: [new aws_codepipeline_actions.S3DeployAction({ actionName: 'S3DeployAction', input: buildOutput, bucket: props.destinationBucket })],
      });

      // invalidation
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
