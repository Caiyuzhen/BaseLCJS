require("dotenv").config({path: ".env"})

// 导入依赖
const OpenAI = require("openai")
const readline = require("readline").createInterface({ // 获得命令行内的输入
	input: process.stdin,
	output: process.stdout
})


// 连接 OpenAI
const secretKey = process.env.OPEN_AI_KEY
const openai = new OpenAI({
	apikey: secretKey
})


// 向用户提问的函数 => 从命令行中取出文字
async function askQuestion(question) {
	return new Promise((res, rej) => { // 异步操作，等待用户的输入并在接收到输入后调用回调函数
		readline.question(question, (answer) => {
			res(answer)
		})
	})
}


async function main() {
	try {
		// 创建助手
		const assistant = await openai.beta.assistants.create({
			name: "饭团",
			instructions: "你是一个大学数学老师, 当用户询问你数学问题时, 调用相关的数学函数并进行回答",
			tools: [{type: "code_interpreter"}],
			model: "gpt-4-1106-preview"
		})
		console.log("\n 开始生成内容");

		// 建立线程
		const thread = await openai.beta.threads.create()

		// 连续对话, 用来判断是否该结束线程
		let keepAsking = true;
		while(keepAsking) {
			const userQuestion = await askQuestion("\n请输入你的问题？") // 调用向用户提问的函数, 从命令行中取出文字

			// 把用户的提问发送到对应的 线程 内
			await openai.beta.threads.messages.create(thread.id, {
				role: "user",
				content: userQuestion,
			})

			// 根据轮询状态码等待助手的回答
			const run = await openai.beta.threads.runs.create(thread.id, {
				assistant_id: assistant.id,
			})

			let runStatus = await openai.beta.threads.runs.retrieve(
				thread.id,
				run.id
			)
			
			// 轮询状态码
			while (runStatus.status !== "completed") {
				await new Promise((res) => setTimeout(res, 2000))
				runStatus = await openai.beta.threads.retrieve(thread.id, run.id)
			}

			// 获得AI 返回的答案, 显示最近的（最后一条）而不是所有, 因为在上面的代码中已经问了一些问题
			const message = await openai.beta.thread.messages.list(thread.id)
			const lastMsgForRun = message.data
				.filter(message => message.run_id === run.id && message.role === "assistant") 
				.pop()
			
			if (lastMsgForRun) {
				console.log( `${lastMsgForRun.content[0].text.value} \n `)
			}

			// 询问用户是否想要继续提问
			const continueAsking = await askQuestion("你还想继续提问吗(yes/no)？")
			keepAsking = continueAsking.toLowerCase() === "yes"

			if(!keepAsking) { // 如果不是 yes
				console.log("好的, 停止继续提问\n")
			}
		}

		readline.close()
	} catch (error) {
		console.log(error)
	}
}

main()

