# AWS CDK CUSTOM CONSTRUCT

custom aws cdk codepipeline made for build, deploy, cloudfront invalidation(optional) for static website.

It's combination of aws-cdk-lib - CodePipeline, CodeBuild, StepFunctions with lambda ( for managing S3, Cloudfront with aws-sdk )

It enables to make independent CodePipeline for frontend and use environment variables referencing other aws cdk resources.

## CodePipeline Description

Stages             | Description
-------------------|---------------------------------------------------------------------------------
Source             | input source action for website (ex.github, codecommit)
Build              | build project of input source
PreDeploy          | empty S3 bucket before deploy
Deploy             | deploy the build output to S3
Invalidation       | (optional) If you are using Cloudfront, cache invalidation will be done.


```typescript
// destination bucket where to put static website build
declare websiteS3Bucket : aws_s3.Bucket
// cloudfront distribution for static website
declare cloudfrontDistribution : aws_cloudfront.Distribution

// this is where to use BuildDeployStaticWebsite
new BuildDeployStaticWebsite(this, 'PipelineFrontend', {
    // you can use BuildDeployStaticWebsiteSource for source action, 
    source: BuildDeployStaticWebsiteSource.codeCommit(
        aws_codecommit.Repository.fromRepositoryName(this, 'CodeCommit', 'aws-cdk-custom-build-deploy-static-website-frontend'),
        'main',
    ),
    // or directly use SourceActions in aws_codepipeline_actions
    source: new aws_codepipeline_actions.CodeCommitSourceAction({
        actionName: 'CodeCommitSourceAction',
        output: new aws_codepipeline.Artifact('sourceArtifact'),
        repository: aws_codecommit.Repository.fromRepositoryName(this, 'CodeCommit', 'aws-cdk-custom-build-deploy-static-website-frontend'),
        branch: 'main',
    }),
    // install script for website build
    installCommands: ['yarn set version stable', 'yarn install'],
    // run script for website build
    buildCommands: ['yarn test', 'yarn build'],
    // you can reference aws cdk resources into website build environment variables like below
    environmentVariables: {
        REACT_APP_TEST: { value: cloudfrontDistribution.distributionDomainName },
    },
    // The build output files will be deployed to this bucket.
    // bucket files will be all cleaned up before deployment.
    destinationBucket: websiteS3Bucket,
    // If this value is set, all files in the distribution's edge caches will be invalidated after the deployment of build output.
    cloudfrontDistributionId: cloudfrontDistribution.distributionId,
    /** there is some optional props more. */
});
```
<!-- 
## 0.0.1
fix relative path error

## 0.0.2
fix destinationBucket interface

put missing export

## 0.0.3
trying to fix type error problem

## 0.0.4
fix some interface name problem

add predeploy stage - empty s3 bucket before deploy

fixed readme

fixed some props initial value
-->