package com.janovel

import org.springframework.boot.fromApplication
import org.springframework.boot.with


fun main(args: Array<String>) {
	fromApplication<JanovelApplication>().with(TestcontainersConfiguration::class).run(*args)
}
