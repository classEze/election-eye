import {
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { TypeORMError } from 'typeorm';

type ResponseObjType = {
  responseCode: number;
  timestamp: string;
  path: string;
  responseMessage: string | object;
};

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const myResObj: ResponseObjType = {
      responseCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      responseMessage: 'Internal Server Error',
    };

    if (exception instanceof UnauthorizedException) {
      myResObj.responseCode = exception.getStatus();
      myResObj.responseMessage = 'Unauthorized';
      this.logger.error(
        `UnauthorizedException: ${JSON.stringify(exception.getResponse())}`,
      );
    } else if (exception instanceof HttpException) {
      myResObj.responseCode = exception.getStatus();
      myResObj.responseMessage = exception.getResponse();
    } else if (exception instanceof TypeORMError) {
      myResObj.responseCode = 422;
      myResObj.responseMessage = 'operation failed due to invalid data';
      this.logger.error(`TypeORMError: ${exception.message}`);
    } else if (exception instanceof Error) {
      myResObj.responseMessage = exception.message;
    } else {
      myResObj.responseCode = 500;
      myResObj.responseMessage =
        'internal server error, please read API documentation for more information';
    }
    this.logger.error(
      `Exception caught: myResObj: ${JSON.stringify(myResObj)}`,
    );
    response.status(myResObj.responseCode).json(myResObj);
  }
}
