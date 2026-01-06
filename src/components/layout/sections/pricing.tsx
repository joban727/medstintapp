"use client"

import { useId } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../ui/card"

enum PopularPlan {
  NO = 0,
  YES = 1,
}

interface PricingProps {
  title: string
  popular: PopularPlan
  price: number
  description: string
  buttonText: string
  benefitList: string[]
}

const pricingList: PricingProps[] = [
  {
    title: "Free",
    popular: 0,
    price: 0,
    description: "Essential features for individual healthcare students and small programs.",
    buttonText: "Get Started",
    benefitList: [
      "1 team member",
      "2 GB storage",
      "Upto 4 pages",
      "Community support",
      "Basic clinical tracking",
    ],
  },
  {
    title: "Premium",
    popular: 1,
    price: 5,
    description: "Advanced features for growing healthcare programs and institutions.",
    buttonText: "Start Free Trial",
    benefitList: [
      "4 team member",
      "4 GB storage",
      "Upto 6 pages",
      "Priority support",
      "Advanced analytics",
    ],
  },
  {
    title: "Enterprise",
    popular: 0,
    price: 40,
    description: "Complete solution for large healthcare institutions and enterprise needs.",
    buttonText: "Contact US",
    benefitList: [
      "10 team member",
      "8 GB storage",
      "Upto 10 pages",
      "Phone support",
      "Enterprise integration",
    ],
  },
]

export const PricingSection = () => {
  const sectionId = useId()
  return (
    <section id={`pricing-${sectionId}`} className="container mx-auto px-4 py-24 sm:py-32">
      <h2 className="mb-2 text-center text-lg text-primary tracking-wider">Pricing</h2>
      <h2 className="mb-4 text-center font-bold text-3xl md:text-4xl">Get unlimited access</h2>
      <h3 className="mx-auto pb-14 text-center text-muted-foreground text-xl md:w-1/2">
        Choose the perfect plan that fits your needs and budget.
      </h3>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {pricingList.map(({ title, popular, price, description, buttonText, benefitList }) => (
          <Card
            key={title}
            className={
              popular === PopularPlan?.YES
                ? "border-[1.5px] border-primary shadow-black/10 shadow-md lg:scale-[1.1] dark:shadow-white/10"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="pb-2">{title}</CardTitle>
              <CardDescription className="pb-4">{description}</CardDescription>
              <div>
                <span className="font-bold text-3xl">${price}</span>
                <span className="text-muted-foreground"> /month</span>
              </div>
            </CardHeader>
            <CardContent className="flex">
              <div className="gap-4">
                {benefitList.map((benefit) => (
                  <span key={benefit} className="flex items-center gap-2">
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 21 21"
                      xmlns="http://www.w3.org/2000/svg"
                      className="flex-shrink-0 fill-current"
                    >
                      <path d="M14.3589 2.6492H7.3756C4.34227 2.6492 2.53394 4.45753 2.53394 7.49087V14.4659C2.53394 17.5075 4.34227 19.3159 7.3756 19.3159H14.3506C17.3839 19.3159 19.1923 17.5075 19.1923 14.4742V7.49087C19.2006 4.45753 17.3923 2.6492 14.3589 2.6492ZM14.8506 9.06587L10.1256 13.7909C10.0089 13.9075 9.8506 13.9742 9.68394 13.9742C9.51727 13.9742 9.35894 13.9075 9.24227 13.7909L6.88394 11.4325C6.64227 11.1909 6.64227 10.7909 6.88394 10.5492C7.1256 10.3075 7.5256 10.3075 7.76727 10.5492L9.68394 12.4659L13.9673 8.18253C14.2089 7.94087 14.6089 7.94087 14.8506 8.18253C15.0923 8.4242 15.0923 8.81587 14.8506 9.06587Z" />
                    </svg>
                    <h3>{benefit}</h3>
                  </span>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant={popular === PopularPlan?.YES ? "default" : "secondary"}
                className="w-full"
              >
                {buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  )
}
