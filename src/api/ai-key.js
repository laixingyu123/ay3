/**
 * AI Key 管理 API
 */

import apiClient, { handleApiResponse } from './client.js';

/**
 * 添加AI API Key
 * @description 添加一个新的AI接口密钥。支持多种Key类型，如CodeRouter等。自动检查Key是否已存在，防止重复添加。
 *
 * **注意事项**：
 * - 当 key_type 为 coderouter 时，建议在 source_name 字段填写 GitHub 用户名，用于标识 Key 的来源
 *
 * @param {Object} keyData - Key数据
 * @param {string} keyData.key - AI接口的API密钥（必需）
 * @param {string} keyData.key_type - API Key的类型（必需）：coderouter | anyrouter | other
 * @param {number} [keyData.quota=0] - API Key的初始额度（可选，默认0，单位：美元）
 * @param {string} [keyData.source_name] - Key的来源或提供者名称（可选）。注意：如果 key_type 是 coderouter，则此字段应填写 GitHub 用户名
 * @param {string} [keyData.account_id] - 关联的AnyRouter账号ID（可选，外键指向anyr-accounts表）
 * @param {boolean} [keyData.is_sold=false] - 该Key是否已出售（可选，默认false）
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 * @example
 * // 添加一个 CodeRouter Key
 * const result = await addKey({
 *   key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   key_type: 'coderouter',
 *   quota: 100,
 *   source_name: 'github_username'
 * });
 * if (result.success) {
 *   console.log('Key添加成功:', result.data);
 * }
 *
 * @example
 * // 添加一个已出售的 AnyRouter Key
 * const result = await addKey({
 *   key: 'sk-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
 *   key_type: 'anyrouter',
 *   is_sold: true
 * });
 */
export async function addKey(keyData) {
	const { key, key_type, quota = 0, source_name, account_id, is_sold = false } = keyData;

	// 验证必需字段
	if (!key) {
		return {
			success: false,
			error: 'API Key不能为空',
		};
	}

	if (!key_type) {
		return {
			success: false,
			error: 'Key类型不能为空',
		};
	}

	// 验证 key 长度
	if (key.length < 1 || key.length > 500) {
		return {
			success: false,
			error: 'API Key长度必须在1-500个字符之间',
		};
	}

	// 验证 key_type 枚举值
	if (!['coderouter', 'anyrouter', 'other'].includes(key_type)) {
		return {
			success: false,
			error: 'Key类型必须为 coderouter、anyrouter 或 other',
		};
	}

	// 验证 quota 必须为非负数
	if (typeof quota !== 'number' || quota < 0) {
		return {
			success: false,
			error: '额度必须为非负数',
		};
	}

	// 验证 source_name 长度（如果提供）
	if (source_name !== undefined && source_name.length > 200) {
		return {
			success: false,
			error: '来源名称不能超过200个字符',
		};
	}

	// 构建请求数据
	const requestData = {
		key,
		key_type,
		quota,
		is_sold,
	};

	// 只有在提供了 source_name 时才添加到请求中
	if (source_name !== undefined) {
		requestData.source_name = source_name;
	}

	// 只有在提供了 account_id 时才添加到请求中
	if (account_id !== undefined) {
		requestData.account_id = account_id;
	}

	return handleApiResponse(apiClient.post('/ai-key-admin/addKey', requestData));
}

/**
 * 批量添加AI API Key
 * @description 批量添加多个AI接口密钥。支持一次性添加多个Key，自动检查重复并返回详细的处理结果。
 *
 * **功能特点**：
 * - 单次最多添加100个Key
 * - 自动跳过已存在的Key
 * - 返回成功和失败的详细统计
 * - 部分失败不影响其他Key的添加
 *
 * **注意事项**：
 * - 当 key_type 为 coderouter 时，建议在 source_name 字段填写 GitHub 用户名
 *
 * @param {Array<Object>} keys - Key数组，最多100个
 * @param {string} keys[].key - AI接口的API密钥（必需）
 * @param {string} keys[].key_type - API Key的类型（必需）：coderouter | anyrouter | other
 * @param {number} [keys[].quota=0] - API Key的初始额度（可选，默认0，单位：美元）
 * @param {string} [keys[].source_name] - Key的来源或提供者名称（可选）
 * @param {string} [keys[].account_id] - 关联的AnyRouter账号ID（可选，外键指向anyr-accounts表）
 * @param {boolean} [keys[].is_sold=false] - 该Key是否已出售（可选，默认false）
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 * @example
 * // 批量添加多个 Key
 * const result = await addKeys([
 *   { key: 'sk-xxx1', key_type: 'anyrouter', quota: 10, source_name: 'user1_出售_1' },
 *   { key: 'sk-xxx2', key_type: 'anyrouter', quota: 20, source_name: 'user2_出售_2' }
 * ]);
 * if (result.success) {
 *   console.log('批量添加结果:', result.data);
 * }
 */
export async function addKeys(keys) {
	// 验证必需字段
	if (!keys || !Array.isArray(keys)) {
		return {
			success: false,
			error: 'keys必须是数组',
		};
	}

	if (keys.length === 0) {
		return {
			success: false,
			error: 'keys数组不能为空',
		};
	}

	if (keys.length > 100) {
		return {
			success: false,
			error: '单次最多添加100个Key',
		};
	}

	// 验证每个 key 对象
	for (let i = 0; i < keys.length; i++) {
		const keyData = keys[i];

		if (!keyData.key) {
			return {
				success: false,
				error: `第${i + 1}个Key的API Key不能为空`,
			};
		}

		if (!keyData.key_type) {
			return {
				success: false,
				error: `第${i + 1}个Key的类型不能为空`,
			};
		}

		if (keyData.key.length < 1 || keyData.key.length > 500) {
			return {
				success: false,
				error: `第${i + 1}个Key的长度必须在1-500个字符之间`,
			};
		}

		if (!['coderouter', 'anyrouter', 'other'].includes(keyData.key_type)) {
			return {
				success: false,
				error: `第${i + 1}个Key的类型必须为 coderouter、anyrouter 或 other`,
			};
		}

		if (keyData.quota !== undefined && (typeof keyData.quota !== 'number' || keyData.quota < 0)) {
			return {
				success: false,
				error: `第${i + 1}个Key的额度必须为非负数`,
			};
		}

		if (keyData.source_name !== undefined && keyData.source_name.length > 200) {
			return {
				success: false,
				error: `第${i + 1}个Key的来源名称不能超过200个字符`,
			};
		}
	}

	// 构建请求数据，为每个 key 设置默认值
	const requestKeys = keys.map((keyData) => {
		const item = {
			key: keyData.key,
			key_type: keyData.key_type,
			quota: keyData.quota ?? 0,
			is_sold: keyData.is_sold ?? false,
		};

		if (keyData.source_name !== undefined) {
			item.source_name = keyData.source_name;
		}

		if (keyData.account_id !== undefined) {
			item.account_id = keyData.account_id;
		}

		return item;
	});

	return handleApiResponse(apiClient.post('/ai-key-admin/addKeys', { keys: requestKeys }));
}

/**
 * 更新API Key信息
 * @description 更新指定API Key的信息。支持通过记录ID或Key值定位记录。
 *
 * **定位方式（二选一）**：
 * - _id: 通过记录ID定位
 * - key: 通过API Key值定位
 *
 * **更新方式**：
 * - updateData: 直接覆盖更新
 * - incData: 增量更新（仅支持数值字段：quota、remain_quota、used_quota）
 *
 * **支持更新的字段**：
 * - key: API密钥
 * - key_type: Key类型
 * - quota: 初始额度（单位：美元）
 * - remain_quota: 剩余额度（单位：美元）
 * - used_quota: 已使用额度（单位：美元）
 * - query_date: 查询时间
 * - quota_update_date: 额度更新时间
 * - account_id: 关联账号ID
 * - source_name: 来源名称
 * - is_sold: 是否已出售
 * - sell_date: 出售时间
 * - is_deleted: 是否删除
 * - delete_date: 删除时间
 *
 * **注意事项**：
 * - _id 和 create_date 字段不允许更新
 * - 只需传入需要更新的字段，无需传入所有字段
 * - _id 和 key 参数至少提供一个
 * - updateData 和 incData 至少提供一个
 * - incData 中的值为正数表示增加，负数表示减少
 *
 * @param {Object} options - 更新选项
 * @param {string} [options._id] - Key记录ID（与key二选一）
 * @param {string} [options.key] - API Key值（与_id二选一）
 * @param {Object} [options.updateData] - 要直接覆盖更新的数据对象
 * @param {string} [options.updateData.key] - AI接口的API密钥
 * @param {string} [options.updateData.key_type] - API Key的类型：coderouter | anyrouter | other
 * @param {number} [options.updateData.quota] - API Key的初始额度（单位：美元）
 * @param {number} [options.updateData.remain_quota] - API Key的剩余可用额度（单位：美元）
 * @param {number} [options.updateData.used_quota] - API Key的已使用额度（单位：美元）
 * @param {number} [options.updateData.query_date] - 最后一次查询额度的时间戳（毫秒）
 * @param {number} [options.updateData.quota_update_date] - 额度信息最后更新的时间戳（毫秒）
 * @param {string} [options.updateData.account_id] - 关联的AnyRouter账号ID
 * @param {string} [options.updateData.source_name] - Key的来源或提供者名称
 * @param {boolean} [options.updateData.is_sold] - 该Key是否已出售
 * @param {number} [options.updateData.sell_date] - Key出售时间戳（毫秒）
 * @param {boolean} [options.updateData.is_deleted] - 标记Key是否已删除（软删除）
 * @param {number} [options.updateData.delete_date] - Key删除时间戳（毫秒）
 * @param {Object} [options.incData] - 增量更新的数据对象（正数增加，负数减少）
 * @param {number} [options.incData.quota] - 初始额度增量值（单位：美元）
 * @param {number} [options.incData.remain_quota] - 剩余额度增量值（单位：美元）
 * @param {number} [options.incData.used_quota] - 已使用额度增量值（单位：美元）
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 * @example
 * // 通过 _id 更新 Key 的额度信息
 * const result = await updateKeyInfo({
 *   _id: '507f1f77bcf86cd799439011',
 *   updateData: {
 *     remain_quota: 85.5,
 *     used_quota: 14.5,
 *     quota_update_date: Date.now()
 *   }
 * });
 * if (result.success) {
 *   console.log('Key更新成功:', result.data);
 * }
 *
 * @example
 * // 通过 key 值定位并标记为已出售
 * const result = await updateKeyInfo({
 *   key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   updateData: {
 *     is_sold: true,
 *     sell_date: Date.now()
 *   }
 * });
 *
 * @example
 * // 使用增量更新减少剩余额度
 * const result = await updateKeyInfo({
 *   _id: '507f1f77bcf86cd799439011',
 *   incData: {
 *     remain_quota: -5.5,
 *     used_quota: 5.5
 *   }
 * });
 */
export async function updateKeyInfo(options) {
	// 验证参数类型
	if (!options || typeof options !== 'object') {
		return {
			success: false,
			error: '参数必须为对象',
		};
	}

	const { _id, key, updateData, incData } = options;

	// 验证定位参数：_id 和 key 至少提供一个
	if (!_id && !key) {
		return {
			success: false,
			error: '_id 和 key 至少需要提供一个',
		};
	}

	// 验证更新参数：updateData 和 incData 至少提供一个
	if (!updateData && !incData) {
		return {
			success: false,
			error: 'updateData 和 incData 至少需要提供一个',
		};
	}

	// 验证 updateData（如果提供）
	if (updateData !== undefined) {
		if (typeof updateData !== 'object' || updateData === null) {
			return {
				success: false,
				error: 'updateData 必须为对象',
			};
		}

		// 不允许更新的字段
		const forbiddenFields = ['_id', 'create_date'];
		for (const field of forbiddenFields) {
			if (field in updateData) {
				return {
					success: false,
					error: `不允许更新 ${field} 字段`,
				};
			}
		}

		// 验证 key_type 枚举值（如果提供）
		if (updateData.key_type !== undefined && !['coderouter', 'anyrouter', 'other'].includes(updateData.key_type)) {
			return {
				success: false,
				error: 'Key类型必须为 coderouter、anyrouter 或 other',
			};
		}

		// 验证数字字段为非负数
		const numericFields = ['quota', 'remain_quota', 'used_quota'];
		for (const field of numericFields) {
			if (updateData[field] !== undefined && (typeof updateData[field] !== 'number' || updateData[field] < 0)) {
				return {
					success: false,
					error: `${field} 必须为非负数`,
				};
			}
		}
	}

	// 验证 incData（如果提供）
	if (incData !== undefined) {
		if (typeof incData !== 'object' || incData === null) {
			return {
				success: false,
				error: 'incData 必须为对象',
			};
		}

		// incData 只支持数值字段
		const allowedIncFields = ['quota', 'remain_quota', 'used_quota'];
		for (const field of Object.keys(incData)) {
			if (!allowedIncFields.includes(field)) {
				return {
					success: false,
					error: `incData 不支持 ${field} 字段，仅支持 quota、remain_quota、used_quota`,
				};
			}
			if (typeof incData[field] !== 'number') {
				return {
					success: false,
					error: `incData.${field} 必须为数字`,
				};
			}
		}
	}

	// 构建请求数据
	const requestData = {};
	if (_id) requestData._id = _id;
	if (key) requestData.key = key;
	if (updateData) requestData.updateData = updateData;
	if (incData) requestData.incData = incData;

	return handleApiResponse(apiClient.post('/ai-key-admin/updateKeyInfo', requestData));
}

export default {
	addKey,
	addKeys,
	updateKeyInfo,
};
