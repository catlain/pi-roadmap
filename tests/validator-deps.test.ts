/**
 * validator-deps.ts 测试 — dependsOn 校验（兼容 string[] 和 number[]）
 */
import { describe, it, expect } from "vitest";
import { validateDependsOn } from "../lib/validator-deps";

describe("validateDependsOn", () => {
	it("空数组不报错", () => {
		const errors: string[] = [];
		validateDependsOn([], new Set(), new Set(), "test", errors);
		expect(errors).toHaveLength(0);
	});

	it("string[] — 引用存在的不报错", () => {
		const errors: string[] = [];
		validateDependsOn(["E1"], new Set(["E1"]), new Set(), "test", errors);
		expect(errors).toHaveLength(0);
	});

	it("string[] — 引用不存在时报错", () => {
		const errors: string[] = [];
		validateDependsOn(["E99"], new Set(["E1"]), new Set(), "item", errors);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("E99");
	});

	it("number[] — 引用存在的不报错", () => {
		const errors: string[] = [];
		validateDependsOn([1, 2], new Set(), new Set([1, 2]), "test", errors);
		expect(errors).toHaveLength(0);
	});

	it("number[] — 引用不存在时报错", () => {
		const errors: string[] = [];
		validateDependsOn([99], new Set(), new Set([1, 2]), "item", errors);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("#99");
	});
});
