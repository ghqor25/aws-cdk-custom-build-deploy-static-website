import { aws_iam, aws_lambda, aws_lambda_nodejs, aws_stepfunctions, aws_stepfunctions_tasks, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface S3EmptyBucketProps {
   /**
    * bucket name for delete all objects
    */
   bucketName: string;
   /**
    * bucket arn for grant policy to lambda
    */
   bucketArn: string;
}

/**
 * stepFunction stateMachine to empty the S3 bucket
 */
export class S3EmptyBucket extends Construct {
   public readonly stateMachine: aws_stepfunctions.StateMachine;
   constructor(scope: Construct, id: string, props: S3EmptyBucketProps) {
      super(scope, id);

      const listObjects = new aws_stepfunctions_tasks.LambdaInvoke(this, 'InvokeListObjects', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'ListObjects', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['s3:ListBucket'],
                  resources: [props.bucketArn],
               }),
            ],
         }),
         payload: { type: aws_stepfunctions.InputType.OBJECT, value: { BUCKET_NAME: props.bucketName } },
      });

      const deleteObjects = new aws_stepfunctions_tasks.LambdaInvoke(this, 'InvokeDeleteObjects', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'DeleteObjects', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['s3:DeleteObject'],
                  resources: [`${props.bucketArn}/*`],
               }),
            ],
         }),
         inputPath: '$.Payload',
      });

      const choiceResult = new aws_stepfunctions.Choice(this, 'Empty Bucket Complete?', { inputPath: '$.Payload' })
         .when(aws_stepfunctions.Condition.stringEquals('$.STATUS', 'SUCCEEDED'), new aws_stepfunctions.Succeed(this, 'Succeeded'))
         .otherwise(new aws_stepfunctions.Fail(this, 'Failed'));

      this.stateMachine = new aws_stepfunctions.StateMachine(this, 'StateMachine', {
         definition: listObjects.next(deleteObjects).next(choiceResult),
         timeout: Duration.minutes(3),
      });
   }
}
