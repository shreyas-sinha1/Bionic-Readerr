import { writeFile } from "node:fs/promises";
import { toBionicPlainText } from "@/src/bionic/engine";
import type { BionicOptions } from "@/src/types/conversion";

export async function writeTxtOutput(filePath: string, text: string, options: BionicOptions): Promise<void> {
  await writeFile(filePath, toBionicPlainText(text, options), "utf8");
}
