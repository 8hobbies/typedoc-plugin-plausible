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

import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const npmExec = process.platform === "win32" ? "npm.cmd" : "npm";
const npxExec = process.platform === "win32" ? "npx.cmd" : "npx";

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

  // Same as spawnSync, except it throws an error if the spawn fails.
  function spawnSyncWithError(
    ...args: Parameters<typeof spawnSync>
  ): ReturnType<typeof spawnSync> {
    const result = spawnSync(...args);
    if ("error" in result) {
      throw new Error(JSON.stringify(result));
    }
    return result;
  }

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
    spawnSyncWithError(npmExec, ["pack"]);
    spawnSyncWithError(npmExec, ["install"], {
      cwd: testDir,
    });
    spawnSyncWithError(
      npmExec,
      ["install", `../8hobbies-typedoc-plugin-plausible-${packageVersion}.tgz`],
      {
        cwd: testDir,
      },
    );
    spawnSyncWithError(npxExec, ["typedoc"], {
      cwd: testDir,
    });
  }

  test("When plausibleSiteDomain is unspecified, does not generate Plausible tracking code", () => {
    runTypedoc(minTypedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      expect(fs.readFileSync(htmlPath, "utf-8")).not.toContain("plausible.io");
    }
  });

  test("When plausibleSiteDomain is specified, generates Plausible tracking code", async () => {
    const typedocConfig = {
      ...minTypedocConfig,
      plausibleSiteDomain: "sub.example.com",
    } as const;

    // Is the script tag what we are looking for?
    function isTargetScript(script: HTMLScriptElement): boolean {
      return (
        script.src === "https://plausible.io/js/script.js" &&
        script.defer &&
        script.getAttribute("data-domain") === typedocConfig.plausibleSiteDomain
      );
    }

    // Does the collection of script contain the target script?
    function containsTargetScript(
      scripts: HTMLCollectionOf<HTMLScriptElement>,
    ): boolean {
      for (const script of scripts) {
        if (isTargetScript(script)) {
          return true;
        }
      }
      return false;
    }

    runTypedoc(typedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      const dom = await JSDOM.fromFile(htmlPath, { contentType: "text/html" });
      const scripts = dom.window.document.getElementsByTagName("script");
      expect(containsTargetScript(scripts)).toBeTruthy();
    }
  });

  test("When plausibleSiteOrigin is specified, generates Plausible tracking code with specified origin", async () => {
    const typedocConfig = {
      ...minTypedocConfig,
      plausibleSiteDomain: "sub.example.com",
      plausibleSiteOrigin: "my.owndomain.com/js/",
    } as const;

    // Is the script tag what we are looking for?
    function isTargetScript(script: HTMLScriptElement): boolean {
      return (
        script.src ===
          `https://${typedocConfig.plausibleSiteOrigin}script.js` &&
        script.defer &&
        script.getAttribute("data-domain") === typedocConfig.plausibleSiteDomain
      );
    }

    // Does the collection of script contain the target script?
    function containsTargetScript(
      scripts: HTMLCollectionOf<HTMLScriptElement>,
    ): boolean {
      for (const script of scripts) {
        if (isTargetScript(script)) {
          return true;
        }
      }
      return false;
    }

    runTypedoc(typedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      const dom = await JSDOM.fromFile(htmlPath, { contentType: "text/html" });
      const scripts = dom.window.document.getElementsByTagName("script");
      expect(containsTargetScript(scripts)).toBeTruthy();
    }
  });

  test("When plausibleSiteOrigin is specified, generates Plausible tracking code with specified origin and corrects backslash", async () => {
    const typedocConfig = {
      ...minTypedocConfig,
      plausibleSiteDomain: "sub.example.com",
      plausibleSiteOrigin: "my.owndomain.com/myCustomDir",
    } as const;

    // Is the script tag what we are looking for?
    function isTargetScript(script: HTMLScriptElement): boolean {
      return (
        script.src ===
          `https://${typedocConfig.plausibleSiteOrigin}/script.js` &&
        script.defer &&
        script.getAttribute("data-domain") === typedocConfig.plausibleSiteDomain
      );
    }

    // Does the collection of script contain the target script?
    function containsTargetScript(
      scripts: HTMLCollectionOf<HTMLScriptElement>,
    ): boolean {
      for (const script of scripts) {
        if (isTargetScript(script)) {
          return true;
        }
      }
      return false;
    }

    runTypedoc(typedocConfig);
    const htmlPaths = htmlNames.map((elem) => path.join(testDir, "docs", elem));
    for (const htmlPath of htmlPaths) {
      const dom = await JSDOM.fromFile(htmlPath, { contentType: "text/html" });
      const scripts = dom.window.document.getElementsByTagName("script");
      expect(containsTargetScript(scripts)).toBeTruthy();
    }
  });
});
