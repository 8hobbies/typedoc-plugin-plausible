/** @license Apache-2.0
 *
 * Copyright 2024 8 Hobbies, LLC <hong@8hobbies.com>
 *
 * Licensed under the Apache License, Version 2.0(the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

describe("All", () => {
  // Dir that contains files used for test.
  const testSrcDir = path.join(__dirname, "test-dir");
  // Dir in which the test performs.
  const testDir = path.join(__dirname, "test-dir-tmp");
  // html file names.
  const htmlNames = [
    "index.html",
    "modules.html",
    "functions/func.html",
  ] as const;
  // Package version number.
  const packageJson: unknown = JSON.parse(
    fs.readFileSync("package.json", "utf-8"),
  );
  if (
    typeof packageJson !== "object" ||
    packageJson === null ||
    !("version" in packageJson) ||
    typeof packageJson.version !== "string"
  ) {
    throw new Error("Invalid package version in package.json.");
  }
  const packageVersion = packageJson.version;

  const minTypedocConfig = {
    $schema: "https://typedoc.org/schema.json",
    entryPoints: ["./index.ts"],
    plugin: ["@8hobbies/typedoc-plugin-plausible"],
  } as const;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Fill the test dir with needed content.
    fs.mkdirSync(testDir);
    for (const f of [
      "README.md",
      "index.ts",
      "package.json",
      "tsconfig.json",
    ]) {
      fs.cpSync(path.join(testSrcDir, f), path.join(testDir, f));
    }
  });

  // Prepare the directory, run `npm install` and run typedoc.
  function runTypedoc(
    typedocConfig: typeof minTypedocConfig & { plausibleSiteDomain?: string },
  ): void {
    fs.writeFileSync(
      path.join(testDir, "typedoc.json"),
      JSON.stringify(typedocConfig),
    );
    spawnSync("npm", ["pack"]);
    spawnSync("npm", ["install"], {
      cwd: testDir,
    });
    spawnSync(
      "npm",
      ["install", `../8hobbies-typedoc-plugin-plausible-${packageVersion}.tgz`],
      {
        cwd: testDir,
      },
    );
    spawnSync("npx", ["typedoc"], {
      cwd: testDir,
    });
  }

  test("When plausibleSiteDomain is unspecified, does not generate Plausible tracking code", () => {
    runTypedoc(minTypedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      // Sanity check.
      expect(fs.readFileSync(htmlPath, "utf-8")).not.toContain("plausible.io");
    }
  });

  test("When plausibleSiteDomain is specified, generates Plausible tracking code", () => {
    const typedocConfig = {
      ...minTypedocConfig,
      plausibleSiteDomain: "sub.example.com",
    } as const;
    runTypedoc(typedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      // Sanity check.
      expect(fs.readFileSync(htmlPath, "utf-8")).toContain(
        `<script defer data-domain="${typedocConfig.plausibleSiteDomain}" src="https://plausible.io/js/script.js"></script>`,
      );
    }
  });
});
