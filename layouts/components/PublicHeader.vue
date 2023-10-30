<template>
  <header class="inset-x-0 top-0 z-50">
    <nav
      class="flex items-center justify-between p-6 lg:px-8"
      aria-label="Global"
    >
      <div class="flex lg:flex-1">
        <a href="#" class="-m-1.5 p-1.5">
          <span class="sr-only">Your Company</span>
          <img class="h-8 w-auto" src="" alt="" />
        </a>
      </div>
      <div class="hidden lg:flex lg:gap-x-12">
        <a href="#" class="text-sm font-semibold leading-6 text-gray-900"
          >Product</a
        >
        <a href="#" class="text-sm font-semibold leading-6 text-gray-900"
          >Features</a
        >
      </div>
      <div class="hidden lg:flex lg:flex-1 lg:justify-end">
        <NuxtLink
          to="/login"
          class="text-sm font-semibold leading-6 text-gray-900"
          >Log in <span aria-hidden="true">&rarr;</span></NuxtLink
        >
      </div>
    </nav>
  </header>
</template>
