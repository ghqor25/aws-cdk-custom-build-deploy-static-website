import { aws_iam, aws_lambda, aws_lambda_nodejs, aws_s3, aws_stepfunctions, aws_stepfunctions_tasks, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface S3EmptyBucketProps {
   /**
    * S3 bucket target.
    */
   bucket: aws_s3.IBucket;
}

/**
 * stepFunction stateMachine to empty the S3 bucket
 */
export class S3EmptyBucket extends Construct {
   public readonly stateMachine: aws_stepfunctions.StateMachine;
   constructor(scope: Construct, id: string, props: S3EmptyBucketProps) {
      super(scope, id);

      const listObjects = new aws_stepfunctions_tasks.LambdaInvoke(this, 'Invoke ListObjects', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'ListObjects', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['s3:ListBucket'],
                  resources: [props.bucket.bucketArn],
               }),
            ],
         }),
         payload: { type: aws_stepfunctions.InputType.OBJECT, value: { BUCKET_NAME: props.bucket.bucketName } },
         outputPath: '$.Payload',
      });

      const deleteObjects = new aws_stepfunctions_tasks.LambdaInvoke(this, 'Invoke DeleteObjects', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'DeleteObjects', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['s3:DeleteObject'],
                  resources: [`${props.bucket.bucketArn}/*`],
               }),
            ],
         }),
         outputPath: '$.Payload',
      });

      const choiceResult = new aws_stepfunctions.Choice(this, 'Empty Bucket Complete ?')
         .when(aws_stepfunctions.Condition.stringEquals('$.STATUS', 'SUCCEEDED'), new aws_stepfunctions.Succeed(this, 'Succeeded'))
         .otherwise(new aws_stepfunctions.Fail(this, 'Failed'));

      this.stateMachine = new aws_stepfunctions.StateMachine(this, 'StateMachine', {
         definition: listObjects.next(deleteObjects).next(choiceResult),
         timeout: Duration.minutes(3),
      });
   }
}
