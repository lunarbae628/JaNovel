package com.janovel

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class JanovelApplication

fun main(args: Array<String>) {
	runApplication<JanovelApplication>(*args)
}
