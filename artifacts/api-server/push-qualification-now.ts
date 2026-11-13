import "./src/load-env";
import { pushQualificationStatusToBigQuery } from "./src/lib/pushQualificationStatusToBigQuery";

const result = await pushQualificationStatusToBigQuery();
console.log(JSON.stringify(result, null, 2));
process.exit(result.emptyStatus ? 1 : 0);
