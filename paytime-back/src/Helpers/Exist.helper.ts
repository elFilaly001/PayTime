import { BadRequestException } from '@nestjs/common';

async function Exist(Model: any, fields: Object, shouldExist: boolean): Promise<any> {
    try {

        const DataExist = await Model.findOne(fields);

        const fieldEntries = Object.entries(fields)
            .map(([key, value]) => `${key}`)
            .join(' or/and ');
        if (!shouldExist) {
            if (DataExist) {
                throw new BadRequestException(`already exists: ${fieldEntries}`);
            }else{

                return DataExist ;
            }
        } else {
            if (!DataExist) {
                throw new BadRequestException(`Expectes ${fieldEntries}`);
            }else{

                return DataExist ;
            }
        }
    } catch (error) {
        throw error;
    }

}

export { Exist }; 