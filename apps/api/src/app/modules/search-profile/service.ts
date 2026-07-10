import { searchProfileSchema } from '@fbs/shared'; import { SearchProfileModel } from './model.js';
export const seedSearchProfile = async()=>{ if(await SearchProfileModel.exists({})) return; await SearchProfileModel.create({name:'Default monitoring profile - add real Freelancer job IDs',keywords:['typescript','node','react'],excludedKeywords:['academic','homework'],jobIds:[],countries:[],languages:['en'],projectTypes:['fixed','hourly'],pollIntervalSeconds:30,notificationEnabled:true,soundEnabled:true}); };
export const listProfiles=()=>SearchProfileModel.find().sort({createdAt:-1});
export const createProfile=(input:unknown)=>SearchProfileModel.create(searchProfileSchema.parse(input));
export const updateProfile=async(id:string,input:unknown)=>SearchProfileModel.findByIdAndUpdate(id, searchProfileSchema.partial().parse(input), {new:true,runValidators:true});
export const activateProfile=async(id:string)=>{ await SearchProfileModel.updateMany({},{$set:{enabled:false}}); return SearchProfileModel.findByIdAndUpdate(id,{$set:{enabled:true}},{new:true}); };
export const activeProfile=()=>SearchProfileModel.findOne({enabled:true}).sort({updatedAt:-1});
