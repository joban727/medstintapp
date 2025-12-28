"use client"

import { Star } from "lucide-react"
import { useId } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel"

interface TestimonialProps {
  image: string
  name: string
  userName: string
  comment: string
  rating: number
}

// Testimonials will be fetched from API in production
const testimonials: TestimonialProps[] = []

export const TestimonialSection = () => {
  const sectionId = useId()

  return (
    <section id={`testimonials-${sectionId}`} className="container mx-auto px-4 py-24 sm:py-32">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-center text-lg text-primary tracking-wider">Testimonials</h2>
        <h2 className="mb-4 text-center font-bold text-3xl md:text-4xl">
          Hear What Our 1000+ Clients Say
        </h2>
      </div>

      <Carousel
        opts={{
          align: "start",
        }}
        className="relative mx-auto w-[80%] sm:w-[90%] lg:max-w-screen-xl"
      >
        <CarouselContent>
          {testimonials.map((review) => (
            <CarouselItem key={review.name} className="md:basis-1/2 lg:basis-1/3">
              <Card className="flex h-full flex-col bg-muted/50">
                <CardContent className="flex flex-grow flex-col">
                  <div className="flex gap-1 pb-4">
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                  </div>
                  <div className="flex flex-1 items-start pb-4">
                    <p className="text-sm leading-relaxed">{`"${review.comment}"`}</p>
                  </div>
                </CardContent>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={review.image} alt="radix" />
                      <AvatarFallback>SV</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <CardTitle className="text-lg">{review.name}</CardTitle>
                      <CardDescription>{review.userName}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  )
}
