import { Schema, model, type InferSchemaType } from 'mongoose';
const schema = new Schema({ route:String, method:String, statusCode:Number, requestId:String, createdAt:{type:Date,default:Date.now,index:true} });
export type ApiRequestLogDocument = InferSchemaType<typeof schema> & { _id: string };
export const ApiRequestLogModel = model('ApiRequestLog', schema);
