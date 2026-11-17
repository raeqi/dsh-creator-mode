/** Copy shared by the decision cards and their recorded outcome. */
export const en = { recordDetails: 'Decision context', title: 'Compare options', details: 'Version and source', note: 'Add requirements or change direction',
  send: 'Send requirements', skip: 'Decide later', close: 'Hide', working: 'Sending…', failed: 'Could not submit. Your draft is kept; try again.',
  recorded: 'Decision recorded', undecided: 'No option selected', selected: 'Selected', waiting: 'Waiting for your choice',
  authorization: 'Choose a direction before continuing', custom: 'Your requirements' }
/** Simplified Chinese copy. */
export const zh: typeof en = { recordDetails: '查看决策说明', title: '比较可选方案', details: '版本与来源', note: '补充需求或换个方向', send: '发送补充需求', skip: '暂不决定', close: '收起',
  working: '正在提交…', failed: '提交失败，已保留填写内容，请重试', recorded: '已记录你的选择', undecided: '暂未选择方案', selected: '已选择',
  waiting: '等待你选择下一步', authorization: '选定方案后再继续下一步', custom: '你的补充需求' }
/** Typed dictionary key for this plugin. */
export type DecisionKey = keyof typeof en
