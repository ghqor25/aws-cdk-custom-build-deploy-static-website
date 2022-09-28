# AWS CDK CUSTOM CONSTRUCT

Custom Aws Cdk CodePipeline made for build, deploy, cloudfront invalidation(optional) for static websites.

Personal work, so might not work in some cases. Please aware.

## Purpose

- Make CodePipeline for frontend, triggered only by source trigger action. Enable to work independently with entire Cdk Pipelines.
- Pass environment variables referencing other aws-cdk resources to frontend when build. So can use different environment variables with each ci/cd stage.(e.g. dev, prod, ...). 


## Need to know

- If you want to change build image, check runtime compatible.
- This custom Codepipeline will be executed once when creation, but not when update. After creation, it will be only triggered by Source Action defined in Source Stage.
- It will automatically empty the S3 bucket before deploy the build output. Be aware of that.
- Cloudfront Invalidation will invalidate all files in the cache. It will cost as 1 path. [Aws Doc](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#PayingForInvalidation)
- Invalidation Stage might take long time(set timeout to 20 mins. But usually end ~ 5 mins). Because createInvalidation often fails especially when do it again in a short time.


## CodePipeline Description

Stages                    | Description                                                      | Aws Cdk Resources Used                 |
--------------------------|------------------------------------------------------------------|----------------------------------------|
Source                    | input source action for website (ex.github, codecommit)          | CodeCommit, Github,.. as input choice  |
Build                     | build project of input source                                    | CodeBuild                              |
PreDeploy                 | empty S3 bucket before deploy                                    | Stepfunctions (2 lambda with aws-sdk)  |
Deploy                    | deploy the build output to S3                                    | CodePipeline S3DeployAction            |
Invalidation (optional)   | If you are using Cloudfront, cache invalidation will be done.    | Stepfunctions (2 lambda with aws-sdk)  |


## Usage

```typescript
// destination bucket where to put static website build
declare websiteS3Bucket: aws_s3.Bucket;
// cloudfront distribution using websiteS3Bucket as an origin.
declare cloudfrontDistribution: aws_cloudfront.Distribution;

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

fixed stepfunction params problem

multi stage tested

## 0.0.5
fixed readme

fixed package.json (repo, keywords)

fixed interval of get invalidation
-->