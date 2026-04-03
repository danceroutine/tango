# Tutorials

Tutorials teach Tango through complete applications that you can run and read alongside the code.

Use this section when you want to see several layers of the framework working together in one running project. A tutorial is the right place to begin if topic guides still feel too abstract and you want to watch models, serializers, migrations, resources, adapters, and host-framework wiring meet in one application.

Each tutorial in this section uses an example application that lives in the Tango repository, so the intended reading style is to keep the code open beside the documentation.

## Choose a tutorial

### [Blog API (Express + SQLite)](/tutorials/express-blog-api)

Start here if you want the clearest first look at how Tango fits inside a conventional Node server. This tutorial shows the relationship between Express, `ExpressAdapter`, model-backed resources, generic views, a custom `APIView`, migrations, and OpenAPI generation.

It is the best first tutorial for most readers because the host framework stays familiar while Tango's layers become visible one by one.

### [Next.js blog (App Router + SQLite)](/tutorials/nextjs-blog)

Choose this tutorial when you want to see the same Tango layers inside the Next.js App Router model. It is useful once you already understand the basic Tango stack and want to see how resource registration and OpenAPI publishing fit into a file-routed framework.

### [Nuxt blog (Nitro + SQLite)](/tutorials/nuxt-blog)

Choose this tutorial when you are building with Nuxt and want to see how Tango fits into Nitro route handlers. It shows the same broad framework ideas as the Express and Next.js tutorials, but in a host runtime with a different routing model and deployment story.

## A good reading order

If you are new to Tango, start with the Express tutorial first. It makes the boundary between the host framework and Tango especially easy to see.

After that, read the tutorial for the host framework you care about most:

- [Blog API (Express + SQLite)](/tutorials/express-blog-api)
- [Next.js blog (App Router + SQLite)](/tutorials/nextjs-blog)
- [Nuxt blog (Nitro + SQLite)](/tutorials/nuxt-blog)

Once a tutorial has made the whole application feel concrete, move into the topic guides and how-to pages for deeper explanations and narrower tasks.

## Related sections

- [Guide](/guide/)
- [Topics](/topics/)
- [How-to guides](/how-to/)
- [Reference](/reference/)
