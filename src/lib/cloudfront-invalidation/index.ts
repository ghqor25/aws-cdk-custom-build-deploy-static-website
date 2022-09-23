import { aws_iam, aws_lambda, aws_lambda_nodejs, aws_stepfunctions, aws_stepfunctions_tasks, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CloudfrontInvalidationProps {
   /**
    * The CloudFront distribution Id.
    * Files in the distribution's edge caches will be invalidated.
    */
   readonly cloudfrontDistributionId: string;
}

/**
 * stepFunction stateMachine for cloudfront invalidation.
 *
 * It might takes long because create invalidation makes timeout error in some cases,
 * like doing right after creating cloudfront distribution or validation with no interval.
 * So total timeout is set to 10 minutes, considered to be long enough.
 */
export class CloudfrontInvalidation extends Construct {
   public readonly stateMachine: aws_stepfunctions.StateMachine;
   constructor(scope: Construct, id: string, props: CloudfrontInvalidationProps) {
      super(scope, id);

      const lambdaCloudfrontCreateInvalidation = new aws_stepfunctions_tasks.LambdaInvoke(this, 'InvokeCreateInvalidation', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'CreateInvalidation', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
            initialPolicy: [
               new aws_iam.PolicyStatement({
                  effect: aws_iam.Effect.ALLOW,
                  actions: ['cloudfront:CreateInvalidation'],
                  resources: [getCloudfrontDistributionArn(Stack.of(this).account, props.cloudfrontDistributionId)],
               }),
            ],
            retryAttempts: 0,
         }),
         payload: { type: aws_stepfunctions.InputType.OBJECT, value: { DISTRIBUTION_ID: props.cloudfrontDistributionId } },
         retryOnServiceExceptions: false,
         timeout: Duration.minutes(9),
      });
      lambdaCloudfrontCreateInvalidation.addRetry({ interval: Duration.minutes(1), backoffRate: 1 });

      const wait30Secs = new aws_stepfunctions.Wait(this, 'WaitForGetInvalidation', {
         time: aws_stepfunctions.WaitTime.duration(Duration.seconds(30)),
      });

      const lambdaCloudfrontGetInvalidation = new aws_stepfunctions_tasks.LambdaInvoke(this, 'InvokeGetInvalidation', {
         lambdaFunction: new aws_lambda_nodejs.NodejsFunction(this, 'GetInvalidation', {
            bundling: { minify: true, sourceMap: false, sourcesContent: false, target: 'ES2020' },
            runtime: aws_lambda.Runtime.NODEJS_16_X,
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

      const choiceResult = new aws_stepfunctions.Choice(this, 'Invalidation Complete?', { inputPath: '$.Payload' })
         .when(aws_stepfunctions.Condition.stringEquals('$.status', 'SUCCEEDED'), new aws_stepfunctions.Succeed(this, 'Succeeded'))
         .when(aws_stepfunctions.Condition.stringEquals('$.status', 'FAILED'), new aws_stepfunctions.Fail(this, 'Failed'))
         .otherwise(wait30Secs);

      this.stateMachine = new aws_stepfunctions.StateMachine(this, 'StateMachine', {
         definition: lambdaCloudfrontCreateInvalidation.next(wait30Secs).next(lambdaCloudfrontGetInvalidation).next(choiceResult),
         timeout: Duration.minutes(10),
      });
   }
}

const getCloudfrontDistributionArn = (account: string, distributionId: string) => `arn:aws:cloudfront::${account}:distribution/${distributionId}`;
