import { aws_codecommit, aws_codepipeline, aws_codepipeline_actions, aws_ecr, aws_s3 } from 'aws-cdk-lib';

/**
 * simple wrapper for easy use of codepipeline input action. followed shape of ```pipelines.CodePipelineSource```
 */
export class BuildDeployStaticWebsiteSource {
   /**
    * Source that is provided by a GitHub repository.
    *
    * If you need access to symlinks or the repository history, use
    * ```
    * BuildDeployStaticWebsiteSource.connection()
    * ```
    * @param ownerRepo Pass in the owner and repository in a single string, like: ``` 'owner/repo' ``` , with no spaces
    * @param branch The branch to use.
    * @param props Source properties
    */
   static gitHub(ownerRepo: string, branch: string, props: GitHubSourceOptions): aws_codepipeline_actions.GitHubSourceAction {
      const [owner, repo] = ownerRepo.split('/', 2);
      if (!owner || !repo) throw Error('ownerRepo should be shape like "owner/repo" with no spaces.');
      const actionName = 'GitHubSourceAction';

      return new aws_codepipeline_actions.GitHubSourceAction({
         actionName,
         output: new aws_codepipeline.Artifact(actionName),
         repo,
         owner,
         branch,
         oauthToken: props.oauthToken,
         trigger: props.trigger,
      });
   }
   /**
    * Source that is provided by a specific Amazon S3 object.
    *
    * Will trigger the pipeline as soon as the S3 object changes, but only if there is a CloudTrail Trail in the account that captures the S3 event.
    * @param bucket The Amazon S3 bucket that stores the source code.
    * @param objectKey The key within the S3 bucket that stores the source code.
    * @param props Source properties
    */
   static s3(bucket: aws_s3.IBucket, objectKey: string, props?: S3SourceOptions): aws_codepipeline_actions.S3SourceAction {
      const actionName = 'S3SourceAction';

      return new aws_codepipeline_actions.S3SourceAction({
         actionName,
         bucket,
         bucketKey: objectKey,
         output: new aws_codepipeline.Artifact(actionName),
         role: props?.role,
         trigger: props?.trigger,
      });
   }
   /**
    * The ECR Repository source CodePipeline Action.
    *
    * Will trigger the pipeline as soon as the target tag in the repository changes, but only if there is a CloudTrail Trail in the account that captures the ECR event.
    * @param repository The repository that will be watched for changes.
    * @param props Source properties
    */
   static ecr(repository: aws_ecr.IRepository, props?: ECRSourceOptions): aws_codepipeline_actions.EcrSourceAction {
      const actionName = 'EcrSourceAction';

      return new aws_codepipeline_actions.EcrSourceAction({
         actionName,
         output: new aws_codepipeline.Artifact(actionName),
         repository,
         imageTag: props?.imageTag,
      });
   }
   /**
    * A CodePipeline source action for the CodeStar Connections source, which allows connecting to GitHub and BitBucket.
    * @param ownerRepo Pass in the owner and repository in a single string, like: ``` 'owner/repo' ``` , with no spaces
    * @param branch The branch to use.
    * @param props Source properties
    */
   static connection(ownerRepo: string, branch: string, props: ConnectionSourceOptions): aws_codepipeline_actions.CodeStarConnectionsSourceAction {
      const [owner, repo] = ownerRepo.split('/', 2);
      if (!owner || !repo) throw Error('ownerRepo should be shape like "owner/repo" with no spaces.');
      const actionName = 'CodeStarConnectionsSourceAction';

      return new aws_codepipeline_actions.CodeStarConnectionsSourceAction({
         actionName,
         connectionArn: props.connectionArn,
         output: new aws_codepipeline.Artifact(actionName),
         owner,
         repo,
         branch,
         codeBuildCloneOutput: props.codeBuildCloneOutput,
         triggerOnPush: props.triggerOnPush,
      });
   }
   /**
    * CodePipeline Source that is provided by an AWS CodeCommit repository.
    *
    * If the CodeCommit repository is in a different account, you must use CodeCommitTrigger.EVENTS to trigger the pipeline.
    * @param repository The CodeCommit repository.
    * @param branch The branch to use.
    * @param props Source properties
    */
   static codeCommit(repository: aws_codecommit.IRepository, branch: string, props?: CodeCommitSourceOptions): aws_codepipeline_actions.CodeCommitSourceAction {
      const actionName = 'CodeCommitSourceAction';

      return new aws_codepipeline_actions.CodeCommitSourceAction({
         actionName,
         output: new aws_codepipeline.Artifact(actionName),
         repository,
         branch,
         codeBuildCloneOutput: props?.codeBuildCloneOutput,
         eventRole: props?.eventRole,
         trigger: props?.trigger,
      });
   }
}

export interface CodeCommitSourceOptions
   extends Readonly<Pick<aws_codepipeline_actions.CodeCommitSourceActionProps, 'codeBuildCloneOutput' | 'eventRole' | 'trigger'>> {}
export interface ConnectionSourceOptions
   extends Readonly<Pick<aws_codepipeline_actions.CodeStarConnectionsSourceActionProps, 'connectionArn' | 'codeBuildCloneOutput' | 'triggerOnPush'>> {}
export interface ECRSourceOptions extends Readonly<Pick<aws_codepipeline_actions.EcrSourceActionProps, 'imageTag'>> {}
export interface S3SourceOptions extends Readonly<Pick<aws_codepipeline_actions.S3SourceActionProps, 'role' | 'trigger'>> {}
export interface GitHubSourceOptions extends Readonly<Pick<aws_codepipeline_actions.GitHubSourceActionProps, 'oauthToken' | 'trigger'>> {}
