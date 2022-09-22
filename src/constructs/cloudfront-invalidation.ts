import { aws_iam, aws_lambda, aws_lambda_nodejs, aws_stepfunctions, aws_stepfunctions_tasks, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path';

interface CloudfrontInvalidationProps {
   /**
    * The CloudFront distribution Id.
    * Files in the distribution's edge caches will be invalidated.
    */
   readonly cloudfrontDistributionId: string;
   /**
    * interval time for checking whether invalidation has been done.
    * @default Duration.seconds(30)
    */
   readonly queryInterval?: Duration;
   /**
    * In some cases, create invalidation might take little longer.
    * you can manage the timeout for create invalidation handler.
    * @default Duration.seconds(5)
    */
   readonly timeoutCreateInvalidation?: Duration;
   /**
    * timeout for total cloudfront invalidation procedure
    * @default Duration.minutes(10)
    */
   readonly timeoutTotal?: Duration;
}

/**
 * stepFunction stateMachine for cloudfront invalidation
 */
export class CloudfrontInvalidation extends Construct {
   public readonly stateMachine: aws_stepfunctions.StateMachine;
   constructor(scope: Construct, id: string, props: CloudfrontInvalidationProps) {
      super(scope, id);
      const cloudfrontCreateInvalidation = new aws_stepfunctions_tasks.LambdaInvoke(this, 'CloudfrontCreateInvalidation', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'CreateInvalidation', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            entry: join('src/lambda', 'stepfunctions/cloudfront-invalidation', 'create-invalidation.ts'),
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['cloudfront:CreateInvalidation'],
                  resources: [getCloudfrontDistributionArn(Stack.of(this).account, props.cloudfrontDistributionId)],
               }),
            ],
            timeout: props.timeoutCreateInvalidation ?? Duration.seconds(5),
         }),
         payload: { type: aws_stepfunctions.InputType.OBJECT, value: { DISTRIBUTION_ID: props.cloudfrontDistributionId } },
      });

      const wait30Secs = new aws_stepfunctions.Wait(this, 'WaitForGetInvalidation', {
         time: aws_stepfunctions.WaitTime.duration(props.queryInterval ?? Duration.seconds(30)),
      });

      const cloudfrontGetInvalidation = new aws_stepfunctions_tasks.LambdaInvoke(this, 'CloudfrontGetInvalidation', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'GetInvalidation', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            entry: join('src/lambda', 'stepfunctions/cloudfront-invalidation', 'get-invalidation.ts'),
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['cloudfront:GetInvalidation'],
                  resources: [getCloudfrontDistributionArn(Stack.of(this).account, props.cloudfrontDistributionId)],
               }),
            ],
         }),
         inputPath: '$.Payload',
      });

      const result = new aws_stepfunctions.Choice(this, 'Invalidation Complete ?', { inputPath: '$.Payload' })
         .when(aws_stepfunctions.Condition.stringEquals('$.status', 'SUCCEEDED'), new aws_stepfunctions.Succeed(this, 'Succeeded'))
         .when(aws_stepfunctions.Condition.stringEquals('$.status', 'FAILED'), new aws_stepfunctions.Fail(this, 'Failed'))
         .otherwise(wait30Secs);

      this.stateMachine = new aws_stepfunctions.StateMachine(this, 'StateMachine', {
         definition: cloudfrontCreateInvalidation.next(wait30Secs).next(cloudfrontGetInvalidation).next(result),
         timeout: props.timeoutTotal ?? Duration.minutes(10),
      });
   }
}

const getCloudfrontDistributionArn = (account: string, distributionId: string) => `arn:aws:cloudfront::${account}:distribution/${distributionId}`;
